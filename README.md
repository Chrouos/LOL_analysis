# LCK Draft Lab

LCK 無懼選角工作台。輸入每一步 Ban／Pick，即可查看下一手候選機率、同版本英雄熱門度與隊伍紅藍方勝率。

## 執行

```sh
python -m http.server --directory dist 8000
```

開啟 http://localhost:8000。選好雙方隊伍及先選方後，依序點英雄完成一局。進下一局時，前面各局被選出的英雄會同時鎖定雙方，僅被 Ban 的英雄可再選。先選方可在每局開始前調整。

## 更新資料

```sh
python prepare.py games.csv all_patches.inter champion.json
```

- [LoL-Draft v2026.08](https://github.com/DeusExMachina1993/LoL-Draft/tree/v2026.08/2026) 提供 `games.csv` 和 `all_patches/all_patches.inter`，匯入器只保留 2026 LCK 正賽與 LCK Cup。原始來源為 [Leaguepedia](https://lol.fandom.com/)。
- [Riot Data Dragon 16.23.1 繁體中文英雄資料](https://ddragon.leagueoflegends.com/cdn/16.23.1/data/zh_TW/champion.json) 提供英雄資料。Data Dragon 的版本用於英雄目錄與圖示，競賽版本則使用逐局資料。
- `dist/data.json` 篩選並正規化了上游資料。逐局和選角部分採 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。Riot 英雄資料和圖示依 Riot 適用條款使用。程式碼採 MIT。

## 統計

候選分數使用相同出手順位的歷史紀錄，加上隊伍偏好（同隊乘 3）、時間半衰期 30 天、每隔一個資料中有觀測的競賽版本乘 0.5。截止日採 UTC 日期且不含當日。過濾不合法英雄後重新正規化。第一版機率尚未校準。

後續依序補選手與對線資料、物件事件、時序回測和單局勝率。當前資料只包含選角與賽果。
