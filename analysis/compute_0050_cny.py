#!/usr/bin/env python3
"""Compute 0050 performance around Taiwan CNY close/reopen dates.

This script fetches:
- TWSE holiday schedule for each year to locate Spring Festival holidays.
- TWSE stock day data for 0050 to compute close/reopen prices.

Outputs:
- analysis/output/0050_cny_results.csv
- analysis/output/0050_cny_results.json
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

OUTPUT_DIR = Path(__file__).resolve().parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

TWSE_STOCK_DAY_URL = (
    "https://www.twse.com.tw/stockDay?response=json&date={date}&stockNo=0050"
)
TWSE_HOLIDAY_URL = (
    "https://www.twse.com.tw/holidaySchedule/holidaySchedule?response=json&date={year}"
)
USER_AGENT = "Mozilla/5.0 (compatible; 0050-cny-script/1.0)"


@dataclass
class HolidayWindow:
    year: int
    close_day: dt.date
    reopen_day: dt.date
    holiday_days: int
    holiday_dates: List[dt.date]


@dataclass
class PriceRow:
    date: dt.date
    close: float


@dataclass
class ResultRow:
    year: int
    close_day: dt.date
    reopen_day: dt.date
    holiday_days: int
    close_day_close: float
    close_day_minus1_close: float
    reopen_close: float
    return_a: float
    return_b: float


def fetch_json(url: str) -> Dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def parse_twse_date(raw: str) -> dt.date:
    # TWSE dates often use ROC year, e.g. 108/01/02
    parts = raw.split("/")
    if len(parts) != 3:
        raise ValueError(f"Unexpected date format: {raw}")
    year = int(parts[0]) + 1911
    month = int(parts[1])
    day = int(parts[2])
    return dt.date(year, month, day)


def fetch_holiday_window(year: int) -> HolidayWindow:
    data = fetch_json(TWSE_HOLIDAY_URL.format(year=year))
    if "data" not in data:
        raise ValueError(f"Missing holiday data for {year}: {data}")
    holiday_dates: List[dt.date] = []
    for row in data["data"]:
        date_raw = row[0]
        name = row[1]
        if any(keyword in name for keyword in ["春節", "除夕", "農曆春節"]):
            holiday_dates.append(parse_twse_date(date_raw))
    if not holiday_dates:
        raise ValueError(f"No Spring Festival holidays found for {year}")
    holiday_dates.sort()
    first_holiday = holiday_dates[0]
    last_holiday = holiday_dates[-1]
    close_day = first_holiday - dt.timedelta(days=1)
    reopen_day = last_holiday + dt.timedelta(days=1)
    holiday_days = (reopen_day - close_day).days - 1
    return HolidayWindow(
        year=year,
        close_day=close_day,
        reopen_day=reopen_day,
        holiday_days=holiday_days,
        holiday_dates=holiday_dates,
    )


def fetch_stock_month(date: dt.date) -> List[PriceRow]:
    payload = fetch_json(TWSE_STOCK_DAY_URL.format(date=date.strftime("%Y%m%d")))
    if "data" not in payload:
        raise ValueError(f"Missing stock data for {date}: {payload}")
    rows = []
    for row in payload["data"]:
        row_date = parse_twse_date(row[0])
        close_raw = row[6].replace(",", "")
        close = float(close_raw)
        rows.append(PriceRow(date=row_date, close=close))
    return rows


def fetch_stock_data(start: dt.date, end: dt.date) -> List[PriceRow]:
    months = []
    current = dt.date(start.year, start.month, 1)
    while current <= end:
        months.append(current)
        if current.month == 12:
            current = dt.date(current.year + 1, 1, 1)
        else:
            current = dt.date(current.year, current.month + 1, 1)
    data: Dict[dt.date, PriceRow] = {}
    for month in months:
        for row in fetch_stock_month(month):
            if start <= row.date <= end:
                data[row.date] = row
    return [data[d] for d in sorted(data.keys())]


def build_results(start_year: int, end_year: int) -> List[ResultRow]:
    holiday_windows = [fetch_holiday_window(year) for year in range(start_year, end_year + 1)]
    all_dates = [
        date
        for window in holiday_windows
        for date in [window.close_day, window.reopen_day]
    ]
    fetch_start = min(all_dates) - dt.timedelta(days=10)
    fetch_end = max(all_dates) + dt.timedelta(days=10)
    price_rows = fetch_stock_data(fetch_start, fetch_end)
    price_by_date = {row.date: row for row in price_rows}
    trading_dates = sorted(price_by_date.keys())

    results: List[ResultRow] = []
    for window in holiday_windows:
        close_day = window.close_day
        reopen_day = window.reopen_day
        if close_day not in price_by_date:
            raise ValueError(f"No close day price for {window.year}: {close_day}")
        if reopen_day not in price_by_date:
            raise ValueError(f"No reopen day price for {window.year}: {reopen_day}")
        close_index = trading_dates.index(close_day)
        if close_index == 0:
            raise ValueError(f"No prior trading day for {window.year} close day {close_day}")
        close_day_minus1 = trading_dates[close_index - 1]
        close_day_close = price_by_date[close_day].close
        close_day_minus1_close = price_by_date[close_day_minus1].close
        reopen_close = price_by_date[reopen_day].close
        return_a = reopen_close / close_day_close - 1
        return_b = reopen_close / close_day_minus1_close - 1
        results.append(
            ResultRow(
                year=window.year,
                close_day=close_day,
                reopen_day=reopen_day,
                holiday_days=window.holiday_days,
                close_day_close=close_day_close,
                close_day_minus1_close=close_day_minus1_close,
                reopen_close=reopen_close,
                return_a=return_a,
                return_b=return_b,
            )
        )
    return results


def write_outputs(results: List[ResultRow]) -> None:
    csv_path = OUTPUT_DIR / "0050_cny_results.csv"
    json_path = OUTPUT_DIR / "0050_cny_results.json"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "Year",
                "CloseDay",
                "ReopenDay",
                "HolidayDays",
                "CloseDay_Close",
                "CloseDayMinus1_Close",
                "Reopen_Close",
                "Return_A",
                "Return_B",
            ]
        )
        for row in results:
            writer.writerow(
                [
                    row.year,
                    row.close_day.isoformat(),
                    row.reopen_day.isoformat(),
                    row.holiday_days,
                    f"{row.close_day_close:.2f}",
                    f"{row.close_day_minus1_close:.2f}",
                    f"{row.reopen_close:.2f}",
                    f"{row.return_a:.6f}",
                    f"{row.return_b:.6f}",
                ]
            )
    with json_path.open("w", encoding="utf-8") as handle:
        json.dump(
            [
                {
                    "year": row.year,
                    "close_day": row.close_day.isoformat(),
                    "reopen_day": row.reopen_day.isoformat(),
                    "holiday_days": row.holiday_days,
                    "close_day_close": row.close_day_close,
                    "close_day_minus1_close": row.close_day_minus1_close,
                    "reopen_close": row.reopen_close,
                    "return_a": row.return_a,
                    "return_b": row.return_b,
                }
                for row in results
            ],
            handle,
            ensure_ascii=False,
            indent=2,
        )


def main() -> int:
    start_year = 2019
    end_year = 2025
    try:
        results = build_results(start_year, end_year)
    except (urllib.error.URLError, urllib.error.HTTPError) as exc:
        print("Network error while fetching TWSE data:", exc)
        return 1
    write_outputs(results)
    print(f"Wrote {len(results)} rows to {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
