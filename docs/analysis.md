# 分析口徑與重跑方式

## 資料覆蓋

| 用途 | 資料與範圍 |
| --- | --- |
| 2025 隊伍、選手、英雄、首物件 | Oracle’s Elixir 鏡像，共 1,456 局，含 LCK 555 局、LPL 817 局、世界賽 84 局 |
| 2026 隊伍、選手與英雄快照 | Oracle’s Elixir 鏡像，LCK 295 局至 5/22、LPL 385 局至 5/17。LPL 缺首巴龍標籤 |
| 2026 五月後勝負驗證 | LoL-Draft 的 5/23–8/30 共 423 局，用於勝負回測 |
| 2026 LCK 季後賽外部驗證 | RiftWise 的 8/29–9/13 共 41 局。歷史輸入有五月下旬至季後賽前的缺口 |
| 2026 世界賽正賽 | Games of Legends 系列賽比分，共 40 個系列賽、76 局。決賽物件時間僅涵蓋四局 |

[2025 CSV](https://github.com/cbplexiglass/LoL-Esports-Regional-Analyses/blob/main/2025_LoL_esports_match_data_from_OraclesElixir.csv) · [2026 CSV](https://github.com/chrisvu1007/league-of-legends-match-predictor/blob/main/data/2026_LoL_esports_match_data_from_OraclesElixir.csv) · [LoL-Draft](https://github.com/DeusExMachina1993/LoL-Draft) · [RiftWise](https://riftwise.gg/tournament/lck-2026-season-playoffs/matches) · [Games of Legends](https://gol.gg/tournament/tournament-matchlist/Worlds%202026%20Main%20Event/)

## 指標怎麼讀

- **英雄對位**依雙方登錄位置配對。實際勝率以整局勝負計算。指定選手後只納入該選手使用英雄 A 的對局。未滿 10 局標為小樣本。
- **Elo 預期**使用當日前的隊伍勝負，各年由零起算，更新係數 K = 24。只在同一批有 Elo 預期的場次算實際與預期差。
- **選手使用率**以該選手出賽紀錄為分母。賽事 Pick 率與 Ban 率分別用完整選用與禁用紀錄的局數為分母。
- **首物件**記為藍方、紅方或無人取得。欄位缺漏不列入分母。首預示者缺標籤時，僅在兩隊合計至多一隻的情況下用總數推得。
- **回測**區分純賽前特徵與已完成選角後才可用的特徵。每個比賽日預估完成後才把當日賽果加入歷史。Log loss 越低表示機率預測越好。
- **五路權重**在 2026 年 1–3 月擬合。歷史對位採 21 天半衰期、每舊一版乘 0.5，並加 8 局中性先驗。6 月至 8 月的完整選角仍有缺口，季後賽結果應連同資料範圍一起讀。

## 重跑

從 repo 根目錄使用既有快照重跑。下列 Python 腳本中的相關性分析需要 NumPy 與 scikit-learn。

```sh
node analysis/lane_weights_backtest.mjs
node analysis/champion_matchup_backtest.mjs
python -B analysis/feature_relationships.py
python -B analysis/build_duel_elo.py
python -B analysis/validate_matchups.py /path/to/LoL-Draft/2026/games.csv
```

更新英雄與賽季快照時使用對應年度 CSV。更新英雄快照後一併重建對位 Elo，讓逐局順序一致。

```sh
python -B analysis/build_slices.py /path/to/2026.csv dist/slices-2026.json
python -B analysis/build_champion_views.py 2026 /path/to/2026.csv
python -B analysis/build_duel_elo.py
```
