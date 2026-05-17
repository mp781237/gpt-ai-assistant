# 2019–2025 台股春節期間 0050 報酬率回測（可重現流程）

## 重要說明（資料取得失敗）
由於執行環境無法連線到 TWSE 與其他外部資料來源（HTTPS 連線被代理回應 403），
目前無法在此環境取得封關/開紅盤日期與 0050 歷史價格，導致 2019–2025 的實際數值無法計算。
已提供完整可重現程式碼，當環境可存取 TWSE API 後即可自動產出表格結果與統計。下方表格以 `N/A`
標註缺失欄位，並保留欄位結構以符合輸出規格。請在可連線環境重新執行程式產出正式結果。

執行指令與錯誤訊息：

```
$ python analysis/compute_0050_cny.py
Network error while fetching TWSE data: <urlopen error Tunnel connection failed: 403 Forbidden>
```

## 輸出總表（欄位結構保留，待資料可用後自動填值）

| Year | CloseDay | ReopenDay | HolidayDays | CloseDay_Close | CloseDayMinus1_Close | Reopen_Close | Return_A | Return_B |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2019 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2020 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2021 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2022 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2023 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2024 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| 2025 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

## 摘要統計（待資料可用後輸出）

- Return_A：勝率、平均報酬、中位數、最小/最大值 → **N/A**
- Return_B：勝率、平均報酬、中位數、最小/最大值 → **N/A**

## 方法說明（可重現）

1. **封關/開紅盤日期**：使用 TWSE 官方 holidaySchedule API（`holidaySchedule?response=json&date=YYYY`）抓取
   2019–2025 年每年「春節/除夕/農曆春節」條目，取春節休市的首日與末日，
   並計算 `封關日 = 首日 - 1 天`、`開紅盤日 = 末日 + 1 天`，
   `休市天數 = (開紅盤日 - 封關日 - 1)`，為日曆天（含週末/連假）。
2. **0050 價格資料**：使用 TWSE 官方 stockDay API（`stockDay?response=json&date=YYYYMMDD&stockNo=0050`）
   依月份抓取日資料，建立交易日序列，並以交易日序列確定「封關前 1 交易日」。
3. **報酬率計算**：
   - Return_A = Close(reopen) / Close(close_day) - 1
   - Return_B = Close(reopen) / Close(close_day - 1 trading day) - 1
4. **封關前 1 交易日確認方式**：由 0050 實際交易日序列（TWSE stockDay API）取封關日前一個
   交易日，完全排除休市日與週末，而非僅以星期判斷。

> 程式碼位於 `analysis/compute_0050_cny.py`，成功連線時會輸出
> `analysis/output/0050_cny_results.csv` 與 `analysis/output/0050_cny_results.json`。
