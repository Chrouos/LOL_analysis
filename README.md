# LOL 賽事數據

分析 LCK、LPL 與世界賽的賽果、英雄選角、首物件和模型回測。

[開啟網站](https://lck-draft-analysis.oooouoa.chatgpt.site/) · [資料覆蓋與來源](https://lck-draft-analysis.oooouoa.chatgpt.site/sources.html) · [分析口徑與重跑方式](docs/analysis.md)

| 想查什麼 | 頁面 |
| --- | --- |
| 比較賽區的首小龍、預示者與巴龍 | [賽區](https://lck-draft-analysis.oooouoa.chatgpt.site/) |
| 查隊伍紅藍方勝率和物件取得率 | [隊伍](https://lck-draft-analysis.oooouoa.chatgpt.site/teams.html) |
| 查選手英雄池和有紀錄的 GD@15 | [選手](https://lck-draft-analysis.oooouoa.chatgpt.site/players.html) |
| 查英雄對位、指定選手對位和 Ban／Pick 率 | [英雄](https://lck-draft-analysis.oooouoa.chatgpt.site/champions.html) |
| 查 2026 世界賽賽果、跨賽區交手與決賽物件時間 | [世界賽](https://lck-draft-analysis.oooouoa.chatgpt.site/worlds.html) |
| 比較模型、樣本數、權重與參數關聯 | [回測](https://lck-draft-analysis.oooouoa.chatgpt.site/backtest.html) |

## 本機預覽

```sh
python -m http.server --directory dist 8000
```

開啟 [localhost:8000](http://localhost:8000/)。網站直接讀取 `dist/` 內的資料快照。Python 與 Node 分析程式位於 `analysis/`。程式碼採 MIT，資料與圖像各有其來源與適用條款。
