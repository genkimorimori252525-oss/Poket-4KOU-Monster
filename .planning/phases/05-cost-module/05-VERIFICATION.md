---
phase: 05-cost-module
verified: 2026-08-19T00:00:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1（コスト経済）: コストを独立させる Verification Report

**Phase Goal:** コストの式が1箇所にまとまり、書き換えても呼び出し側を触らんで済む
**Status:** passed
**Requirements:** COST-01, COST-02, COST-03, VER-02, VER-03

## なんでこのフェーズが先やったか

計画18.5 の警告:

> コストは**損失額と獲得額の両方**を決めるようになった。もしある四皇モンのコストが
> 不当に安く見積もられていた場合、その個体は「強い」と「死んでも痛くない」と
> 「刺客ボーナスが大きい」を**三重取り**する。確実に壊れる。

経済を載せた後で式を触ると、損失も獲得も同時に動いて何が原因か分からんくなる。
**先に式を隔離してから**経済を載せる。

## 成功基準ごとの結果

### 1. `src/cost.js` が独立して存在し、式・重み・定数がそこに集まっとる — ✓ 通過

```
COST.W  6項目   ステータスの重み（atk/def/hp/spd/eva/int）
COST.K  6項目   statScale statPivot statCurve movePower moveExtra floor
COST.of         本体
```

**散らばっとった数字を全部名前付きにした。** 前は式の中に `27` `50` `2.45` `0.12` `2` が
直接書かれとった。実戦で歪みが見えたときに、どれを動かせばよいか分からん状態やった。

`statCurve: 2.45` は「上に行くほど急に高くなる」— 線形やと格上が安すぎて、
刺客ボーナスが壊れる（計画18.5 が言う三重取りの入口）。

### 2. 差し替え前後で全個体のコストが一致 — ✓ 通過（2406通り・相違0）

**剥がす前に答えを控えた。** `tools/cost_baseline.js` で 2406 通り:

```
格子      atk/def/hp を [1,10,45,80,115,150,200] で総当り
          残り3軸は前3つから決め打ちで導出（乱数を使わん）
          技は0本〜6本まで
保存個体  BAZERGIUS Chinsuke Mantis PALKIA Rottuo（本物5体）
内蔵の相手 battle.tpl.html の FOES
```

剥がした後に `tools/verify_cost.js` で突き合わせ:

```
突き合わせ  2406 通り中 0 件が相違
```

**なんで「同じはず」やのに数えたか。** 丸め・順序・既定値のどれか1つズレただけで
コストは動く。コストは損失も獲得も決めるけん、1でもズレたら経済ごと歪む。
「変えとらん」は言うだけなら簡単やが、それは主張であって証拠やない。

### 3. 内訳が取り出せる — ✓ 通過（掟9）

```
内訳 = avg / base / cost / mv
```

`costOf()` は数字1つやのうて内訳ごと返す。バランスが崩れたとき、
ステータス側が原因か技側が原因かを切り分けられる。

### 4. 呼び出し側を1行も触っとらん — ✓ 通過

`costOf()` を薄い皮として残した。

```
src/battle.tpl.html:791    f.cost=def.cost||costOf(...)
src/creator.tpl.html:694   ctx.fillText('COST '+costOf(mon).cost, ...)
src/creator.tpl.html:973   cost:costOf(mon).cost
src/creator.tpl.html:1928  const c=costOf(mon)
src/creator.tpl.html:2174  '（COST '+costOf(foe.mon).cost+...
```

**5箇所すべて無変更。** 皮が本体を通っとることも検証で確かめとる
（別実装が二重に生きとったら気付けんけん）。

## 掟をどう守ったか

- **掟1（決定論）** … `determinismTest()` ok
- **掟4（画像を増やさん）** … 絵は1枚も増えとらん
- **掟6（コストは編成枠やない）** … 上限で編成を縛る仕掛けは入れとらん。式だけ
- **掟8（音の決定権）** … 音に触っとらん
- **掟9（内訳が見える）** … `avg/base/cost/mv` を返す形を守った
- **`src/sfx_bank.js`** … HEAD とハッシュ一致

## フェーズ終了時点

```
npm run verify:cost       2406通り 相違0 ・決定論 ok
npm run check:untouched   不可触 1件 HEAD と一致
npm run verify（4段）      exit=0
npm run verify:range      exit=0
npm run verify:store      exit=0
npm run verify:wire       exit=0
npm run verify:dev        exit=0
npm run verify:migration  exit=0
```

保存データの中身が無傷なことも JSON として突き合わせて確認
（BAZERGIUS / Chinsuke / Mantis / PALKIA / Rottuo / creator-auto、全件一致）。

## 次のフェーズへ渡すもの

`COST.K` が触れる形で出とるけん、Phase 2 で経済の定数（初期値150・上限300・
係数k 0.5・比率上限2.0）も同じ場所に並べられる。**実戦で歪みが出たとき、
動かす場所が1箇所に揃う**のがこのフェーズの成果。
