# LOL 賽事數據

[網站](https://lck-draft-analysis.oooouoa.chatgpt.site)涵蓋 2025 LCK、LPL 與世界賽。比賽場域和隊伍所屬賽區各自標記。包含逐日賽前回測、隊伍首物件取得率、紅藍方勝率和選手英雄使用率。

## 重跑

下載 [Oracle’s Elixir 2025 CSV 快照](https://github.com/cbplexiglass/LoL-Esports-Regional-Analyses/blob/main/2025_LoL_esports_match_data_from_OraclesElixir.csv)，SHA-256 為 `1adfa81d8ea54cd62b332d18f8a4089cb64331da448b11f0ff7084fac55ed406`。

```sh
python analysis/backtest.py path/to/2025.csv
python analysis/build_dashboard.py path/to/2025.csv
python -m http.server --directory dist 8000
```

## 指標

- 回測從 2025-04-01 起，同日資料整批留出。基準為同場域歷史結果頻率。模型加入雙方隊伍以往的結果。時間半衰期 60 天，每兩個小版本折半，跨場域權重 0.5。
- 首物件以藍方、紅方、無人取得計分。缺標籤排除。首預示者可在兩隊合計至多一隻時由取得數推得。LPL 缺首巴龍標籤。
- 把原始資料標為世界賽的 12 局 LPL 資格賽歸回 LPL。隊伍賽區按 2025 賽季登錄。
- 選手英雄使用率以同場域、隊伍、位置出賽局數為分母。
- MIT 適用程式碼。賽事統計來源為 Oracle’s Elixir。
