---
phase: 10-look
verified: 2026-08-19T00:00:00Z
status: human_needed
score: 5/5 must-haves verified（読み合いとして面白いかは人が見る）
behavior_unverified: 1
overrides_applied: 0
---

# Phase 3（反動と間）: 見た目を分ける Verification Report

**Phase Goal:** 見とる人が「撃てん／撃たん／溜めとる」を見分けられる
**Status:** human_needed —— 機械で確かめられる範囲はすべて通過。**面白いかはにーくらが見る**
**Requirements:** LOOK-01〜05, KEEP-01〜03, VER-01, VER-02, VER-03

## にーくらの指定

> 白くなる表示は、四皇モンを**静止させながら白く点滅**させるのを技のクールダウン（反動）にすべきかな。
> もちろん、常にしろく点滅するのは違うから、CDと間をわけてほしいけどね。

> 遠隔、遠距離攻撃のアニメーションは、**すでにある自作技に影響がないように**しないとね。

## 成功基準ごとの結果

### 1. 反動＝静止させながら白く点滅 — ✓ 通過（LOOK-01）

```
白 0.62 / 動く false / 繰り返し true
```

**`動く false` が肝。** `sx/sy/dx/dy` を1回も動かしとらん。
「攻撃したくてもできない状態」やけん、動いたら「動けん」に見えんくなる。

### 2. 間＝白やない別の表現 — ✓ 通過（LOOK-02）

```
白 0 / 動く true
```

腰を落として構え、小刻みに揺れる。**待機（idle）と見分けが付くように
重心を下げて横に構える**のが違い。白は使っとらん（白は反動のもの）。

### 3. 溜め＝白を外す — ✓ 通過（LOOK-03）

```
白 0.6 → 0 / 動く true
```

溜めらしさは**大きく波打つ拡縮**で出した。白より動きの方が「力を溜めとる」に近い。
これで**表現と意味のずれが解けた** —— にーくらが「反動に見える」と言うたのは、
溜めが白かったからやった。

### 4. 画素で見分けが付く — ✓ 通過（LOOK-04）

同じ場面で3つの構えを作って、白い画素を数えた:

```
反動 1567 / 間 951 / 溜め 950 / 待機 949
```

**白いのは反動だけ。** 他の3つは横並び（差2画素以内）。

実戦2分で3つとも絵に出とる:

```
recoil 1772 / idle 1713 / attack 1617 / hurt 506 / dodge 354
charge 282 / faint 217 / hold 170 / appear 123 / knockback 106
```

### 5. 既存を壊しとらん — ✓ 通過（KEEP-01〜03）

**割り当て（分類→anim名）は1つも変わっとらん:**

```
projectile → ranged→attack/0.42     lightning → remote→charge
beam       → ranged→attack/0.42     aura      → remote→charge
slash      → melee→attack           shatter   → remote→charge
```

変えたんは `anims.js` の中身だけ。**`MOVE_RANGE` の表には指1本触れとらん。**

`motions` を自前で書いた技は既定に食われん（`jump/1.25` のまま勝つ）。

にーくらの保存個体の自作技5本:

```
バゼルギウス「爆撃」    ranged (自前)      → 無影響
バゼルギウス「灼熱弾」  ranged → attack
ちんすけ「殴打」        remote (自前)      → 無影響
パルキア「亜空切断」    remote → charge    ← 白が抜けて短く見えるようになった
ロッツォ「殴打」        remote (自前)      → 無影響
```

**5本中3本は最初から無影響。** 残り2本のうち、パルキアのは
にーくら自身が「実機の方が長い、変やろ」と言うとった方やけん、
これが直ったんは望んだ変化の側や。

### 6. 絵を増やしとらん・決定論 — ✓ 通過（LOOK-05・掟1）

```
src/ と dist/ の絵ファイル 0枚
determinismTest() ok
```

## 実装で気を付けたこと

待機系の動き（`idle` / `recoil` / `hold`）を **白名簿（`REST_ANIMS`）** にした。
構えが変わったときに差し替えてよいのはこの3つだけ ——
**攻撃や被弾の最中に割り込んだら、技のモーションが途中で消える**。

前は動きが終わると無条件に `idle` へ落ちとった。
そこを `restAnim()` に替えて、構えをそのまま絵にしとる。
「撃てん」も「撃たん」も同じ棒立ちに見えとったのが、これで分かれた。

## 人の目が要ること

**読み合いとして面白いかは機械では分からん。**

`npm run dev` → 戦闘テスト → 試合を見て:

1. 白く点滅して固まっとるとき、「今こいつは撃てんのやな」と分かるか
2. 腰を落として構えとるとき、「様子見しとるな」と分かるか
3. 溜めと反動が**見間違えんか**

面白くなかったら `HOLD_W`（間を取る重み）を触る。1箇所にまとめてある。
絵の方は `anims.js` の `recoil` / `hold` / `charge` の3つ。

## フェーズ終了時点

```
検証12本すべて exit=0:
  verify / verify:stance / verify:ma / verify:look / verify:cost
  verify:econ / verify:bar / verify:range / verify:wire / verify:store
  verify:dev / verify:migration
npm run check:untouched   不可触 1件 HEAD と一致
```
