---
phase: 03-five-support-moves
plan: 02
subsystem: move-fx
tags: [move-fx, support-moves, canvas-fx, rebuilt-move-meta, sand-attack, saito-butt-hide, non-reuse-gate]

requires:
  - phase: 03-01
    provides: "kind:'support' 化された既存3本（りゅうのまい・どくどく・うずしお）と、tools/verify_support.js の段1〜3＋実走行（本数・技名を決め打ちせず kind:'support' を拾う設計）"
provides:
  - "すなかけ・斎藤尻隠れ の2本が専用generator（sand_attack_move / saito_butt_hide_move）と専用FXクラス（SandAttackMoveFX / SaitoButtHideMoveFX）を持って棚に載った。素材の流用は0件（tools/verify_rebuilt_moves.js が parts=0・非流用正規表現・描画署名の一意性で確認）"
  - "補助技5本が atk/def/eva/spd の4stat と self/foe の両方を通った（tools/verify_support.js 段1）"
  - "tools/verify_rebuilt_moves.js の「39」決め打ちが SUPPORT_NAMES/ALL からの導出に変わり、以後この表に技を足しても数字の手直しが要らんようになった"
affects: [03-03-cost-and-gate]

actuals:
  tokens: 3169
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "REBUILT_MOVE_META / REBUILT_MOVE_FX の2表登録パターンを補助技へそのまま拡張。fx_core.js の spawnFX 分岐・move_range.js の BY_GENERATOR・movelab.js の SCHEMA/mlGeneratorKeys は3ファイルとも無改修のまま追従した（設計どおり）"
    - "非流用ゲートの「N本」決め打ちを ALL=[...names,...SUPPORT_NAMES] からの導出へ変える形。件数assert4か所・走査ループ3か所を対象リストの長さ基準に統一し、次に技が増えても手直しが要らん恒久形にした"

key-files:
  created: []
  modified:
    - src/fx_rebuilt_moves.js
    - src/anims_rebuilt_moves.js
    - data/moves/library.json
    - tools/verify_rebuilt_moves.js
    - dist/shioumon_field_test.html
    - dist/shioumon_creator.html
    - dist/shioumon_effect_lab.html
    - dist/shioumon_audio_lab.html

key-decisions:
  - "すなかけ の基準点は this.t（相手位置）。渦・炎・葉・稲妻・rmRingBurstは描かず、砂床の三日月＋放物線で舞い上がる砂粒＋命中後の砂膜の3層構成にして、うずしお（螺旋の渦）・どくどく（髑髏）と絵の骨格を分けた"
  - "斎藤尻隠れ の基準点は this.f（使用者位置、DragonDanceMoveFXと同じ作法）。落下する本体・着地の砂煙・衝撃の輪（ビック尻ドロップの語彙）は一切描かず、二つ割れの盾＋脈打つ守りの層3枚＋回る守りの粒、という守りの構成にして絵の被りを避けた"
  - "REBUILT_MOVE_META/REBUILT_MOVE_FXへの新規2エントリは、既存の補助3本（dragon_dance_move/toxic_move/whirlpool_move）の直後・rock_slide_moveの直前に挿入し、支援技をひとかたまりに並べる既存の並び順の意図を踏襲した"
  - "tools/verify_rebuilt_moves.js の件数assertは39を41へ書き換えず、SUPPORT_NAMES定数とALL=[...names,...SUPPORT_NAMES]からの導出へ変えた（数字のハードコードを1つも残さない、プランの明示指示どおり）。名前一致検査（names.every）は対象範囲が違う検査（『対象39技とmetadata名が一致するか』）のため意図的に無変更のまま残した"

patterns-established:
  - "専用素材を追加するたびに書き換えが要る決め打ち数値を、SUPPORT_NAMES的な『このフェーズで足した技のリスト』＋ALL＝既存リスト+新規リストの合成、という形で恒久的に解消するパターン。次のフェーズで技が増えても tools/verify_rebuilt_moves.js は無改修で追従する"

requirements-completed: [MOVE-01, MOVE-02, MOVE-04, VER-02, VER-03]

coverage:
  - id: D1
    description: "すなかけ が専用generator(sand_attack_move)と専用FXクラス(SandAttackMoveFX)を持ち、idea→madeへ昇格。battle.kind='support'/power=0/effect={eva,-20,16,foe}(|delta|×dur=320)で棚に載った"
    requirement: MOVE-01
    verification:
      - kind: e2e
        ref: "tools/verify_movelist.js（made=57件・idea 68→まで昇格・dist一致）"
        status: pass
      - kind: e2e
        ref: "tools/verify_support.js（段1、すなかけを4件目として自動で拾う）"
        status: pass
      - kind: other
        ref: "node tools/check_untouched.js（src/sfx_bank.js 不可触）"
        status: pass
    human_judgment: false
  - id: D2
    description: "斎藤尻隠れ が専用generator(saito_butt_hide_move)・専用FXクラス(SaitoButtHideMoveFX)・専用ANIMS(dur1.40)を持つ新規レコードとして棚に追加。battle.kind='support'/power=0/effect={def,+22,16,self}(|delta|×dur=352)"
    requirement: MOVE-01
    verification:
      - kind: e2e
        ref: "tools/verify_movelist.js（made=58件・dist一致）"
        status: pass
      - kind: e2e
        ref: "tools/verify_support.js（段1、5件全て・4stat/self・foe網羅）"
        status: pass
      - kind: e2e
        ref: "tools/verify_butt_animation.js（ビック尻ドロップ専用ゲートが無傷）"
        status: pass
    human_judgment: false
  - id: D3
    description: "2本とも |effect.delta|×effect.dur >= 270（名目値・すなかけ320、斎藤尻隠れ352）を満たし、既存の補助3本と合わせ5本全てが段1の構造検査（stat/target/delta/dur/power/generator）を通る"
    requirement: MOVE-02
    verification:
      - kind: e2e
        ref: "tools/verify_support.js（段1、5件とも|delta|×dur>=270・stat=atk/def/eva/spd・target=self/foe）"
        status: pass
    human_judgment: false
  - id: D4
    description: "新規2クラスとも既存素材(ProjectileFX等)・parts・spawnSubFX/drawImpactを1つも呼ばず、drawMaterial()のみ実装(updateは無上書き)。tools/verify_rebuilt_moves.jsの「39」決め打ちがSUPPORT_NAMES/ALL(=41)からの導出に変わり、非流用・威力連動・決定論・描画署名一意性の閾値を1つも緩めずに通った"
    requirement: MOVE-04
    verification:
      - kind: e2e
        ref: "tools/verify_rebuilt_moves.js（41 generator/class・parts=0・威力0/100で署名変化・powerLevel別ops検査・描画署名重複なし・命中callback1回・演出900フレーム以内で終了）"
        status: pass
    human_judgment: false
  - id: D5
    description: "検証チェーン全段(workflow.test_command 8段＋verify_rebuilt_moves＋check_untouched)がグリーンで、src/fx_core.js・src/move_range.js・src/movelab.jsは無改修のまま5本の専用登録に自動追従した"
    requirement: VER-02
    verification:
      - kind: other
        ref: "node build.js && node build.js --dev && node tools/verify_style.js && node tools/verify_signature_moves.js && node tools/verify_movelist.js && node tools/verify_learnable.js && node tools/verify_support.js && node tools/verify_creator.js && node tools/verify_rebuilt_moves.js && node tools/check_untouched.js（全段exit0）"
        status: pass
    human_judgment: false
  - id: D6
    description: "src/sfx_bank.js が HEAD と1バイトも変わっとらん（不可触の掟）。新しい画像ファイルも1枚も増えとらん（掟4・全部canvas描画）"
    requirement: VER-03
    verification:
      - kind: other
        ref: "node tools/check_untouched.js（同じ）／git status --short（新規png/jpg/webp無し）"
        status: pass
    human_judgment: false

duration: 約9分（コミット間隔。読み込み〜Task1着手までの時間は開始時刻を記録し損ねたため概算しない）
completed: 2026-08-21
status: complete
---

# Phase 3 Plan 02: すなかけ・斎藤尻隠れの専用FX新造と非流用ゲートの恒久化 Summary

**すなかけ（相手のeva−20/16秒）と斎藤尻隠れ（自分のdef+22/16秒）に専用generator・専用FXクラス（canvas描画のみ・素材流用ゼロ）を新造して棚へ載せ、`tools/verify_rebuilt_moves.js` の「39」決め打ちを `SUPPORT_NAMES`/`ALL` からの導出に変えて、補助技5本全体が atk/def/eva/spd と self/foe を通した状態にした。**

## Performance

- **Duration:** 約9分（Task 1コミット→Task 3コミットの間隔。読み込みフェーズを含めた総時間は開始時刻記録漏れのため概算しない）
- **Completed:** 2026-08-21T13:26:36Z（UTC、Task 3コミット時刻）
- **Tasks:** 3/3
- **Files modified:** 8（`src/fx_rebuilt_moves.js`, `src/anims_rebuilt_moves.js`, `data/moves/library.json`, `tools/verify_rebuilt_moves.js`, `dist/`の4ファイル。`dist-dev/*`はgitignore対象のためコミット対象外）

## Accomplishments

- **`SandAttackMoveFX`（すなかけ）**：相手の足元に砂床の三日月が1枚現れ、そこから砂粒が個別の初速・横ぶれ（`hash3`固定シード）で上向きの放物線を描いて舞い上がる（円盤と菱形を混ぜて大小をつける）。命中後は相手の目の高さに横長の砂の膜が薄れながら残る。渦（うずしお）・髑髏（どくどく）とは絵の骨格を分け、炎・葉・稲妻・`rmRingBurst`は使っていない。
- **`SaitoButtHideMoveFX`（斎藤尻隠れ）**：使用者の前方（`this.ang`のcos符号で向きを判定）に二つ割れの尻の盾が下から競り上がり（`rmEase`でイージング）、外周に脈打つ守りの層3枚（`Math.sin(time*6+k*2.1)`）、上を回る守りの粒（`rmStar`×n）を描く。落下する本体・着地の砂煙・衝撃の輪（ビック尻ドロップの語彙）は一切描いていない——「跳び込んで接触する攻撃技」と「その場で隠れる守りの技」を絵で区別した。
- `REBUILT_MOVE_META`/`REBUILT_MOVE_FX` の2表へそれぞれ1行ずつ登録（`src/fx_core.js`のspawnFX分岐・`src/move_range.js`のBY_GENERATOR・`src/movelab.js`のSCHEMA/GEN_JP/GEN_DESC/mlGeneratorKeysは1文字も触っていない——設計どおり全部自動で追従した）。
- `src/anims_rebuilt_moves.js` に `saito_butt_hide_move`（dur1.40：腰を落とす→尻を突き出す→背を丸めて縮こまる→じわり戻る）を新設。既存のどのキー配列とも一致しない。
- `data/moves/library.json`：すなかけを `idea`→madeへ昇格（`status`/`hint`/`note`を削除し、`battle`/`audio`/`fx`を追加）。斎藤尻隠れを新規レコードとして追加。両方とも`audio:[]`（音の決定権は100%にーくら・掟8）。
- `tools/verify_rebuilt_moves.js`：`SUPPORT_NAMES=['すなかけ','斎藤尻隠れ']`と`ALL=[...names,...SUPPORT_NAMES]`を新設。件数assert4か所（専用metadata数・専用class登録数・class名の一意性・generatorの一意性）を`===39`から`===ALL.length`へ、走査ループ3か所（libraryレコードの非流用検査・描画署名の一意性検査・motions→ANIMS実在チェック）を`names`から`ALL`へ拡張。検査の閾値（`ops>=12`・署名一意性・命中callback1回・非流用の正規表現）は1つも緩めていない。
- 検証チェーン全段（`workflow.test_command`の8段 + `verify_rebuilt_moves.js` + `check_untouched.js`）が全てグリーン。

## Task Commits

Each task was committed atomically:

1. **Task 1: すなかけ —— 専用generator・専用クラス・棚への昇格（MOVE-01, MOVE-02, MOVE-04）** - `a2d39dd` (feat)
2. **Task 2: 斎藤尻隠れ —— 専用generator・専用クラス・専用ANIMS・棚への新規追加（MOVE-01, MOVE-02, MOVE-04）** - `590af46` (feat)
3. **Task 3: `verify_rebuilt_moves.js`の「39本」決め打ちを解いて、新規2本を非流用検査へ通す（MOVE-04, VER-02, VER-03）** - `9243b80` (test)

_Note: Task 1・Task 2 の`<verify>`は意図的に`verify_rebuilt_moves.js`を含まない（プランの明記どおり、この段階では「39本ではない」系の赤が正しく出る）。実際に踏んだ赤は3件（専用metadataが39本ではない／専用class登録が39本ではない／複数generatorが同じclassを流用している）で、いずれもカウント系のみ。2クラスの描画・非流用・威力連動・決定論・署名一意性・命中callback回数は、Task 3でverify_rebuilt_moves.jsを初めて通しで走らせた時点で一度も赤を出さず一発通過した——検査を緩めて通した箇所は0件。_

## Files Created/Modified

- `src/fx_rebuilt_moves.js` - `SandAttackMoveFX`/`SaitoButtHideMoveFX`の2クラスを新設。`REBUILT_MOVE_META`/`REBUILT_MOVE_FX`に各2行を追加
- `src/anims_rebuilt_moves.js` - `saito_butt_hide_move`（dur1.40）を新設
- `data/moves/library.json` - すなかけをidea→made昇格、斎藤尻隠れを新規追加
- `tools/verify_rebuilt_moves.js` - `SUPPORT_NAMES`/`ALL`を新設し、件数assert4か所と走査ループ3か所を導出形へ変更
- `dist/` の4ファイル - `node build.js`/`node build.js --dev`の焼き直し

## Decisions Made

- **すなかけの基準点は`this.t`（相手位置）、斎藤尻隠れの基準点は`this.f`（使用者位置）。** move_specの指定どおり、既存の相手掛け技（どくどく・うずしお）・自分掛け技（りゅうのまい）の作法をそれぞれ踏襲した。
- **REBUILT_MOVE_META/REBUILT_MOVE_FXへの挿入位置は既存の補助3本の直後（rock_slide_moveの直前）。** 支援技をひとかたまりに並べる既存の並び順の意図を踏襲し、可読性を優先した（機能上は挿入位置は自由）。
- **`verify_rebuilt_moves.js`の件数assertは数字を41へ書き換えず、対象リストの長さから導出する形にした。** プランの明示指示どおり——次にこの表へ技を足しても、テストコード側の手直しが不要になる恒久的な形。
- **`names.every(...)`（「対象39技とmetadata名が一致するか」の検査）は意図的に無変更のまま残した。** 補助技は別の系譜（プラン記載どおり）のため、この検査の対象範囲を広げる理由がない。

## Deviations from Plan

None - plan executed exactly as written。数値（すなかけ eva −20/16秒、斎藤尻隠れ def +22/16秒、cast/cooldownの投影値）はいずれも`03-01-PLAN.md`の`<numbers>`投影表とmove_specの表どおりに実装し、変更していない。

## Issues Encountered

- **`git status --short`は着手時・各コミット前とも一貫してクリーンだった。** Codexとの作業ツリー共有問題（03-CONTEXT.mdが警告）は今回も発生しなかった。`tools/_movelist-shot.png`のみ検証実行の副産物として更新されているが、これは自分自身のPlaywright検証（`verify_movelist.js`）が毎回上書きする既存の追跡済みスクリーンショットで、Codexの変更でも今回の`files_modified`対象でもないため、03-01と同じ扱い（コミットせず残置）とした。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 補助技5本（りゅうのまい・どくどく・うずしお・すなかけ・斎藤尻隠れ）全てが`tools/verify_support.js`の段1〜3＋実走行ブロックへ、コード変更ゼロで自動的に拾われている（`03-01`が確立した「本数・技名を決め打ちしない」設計どおり）。
- `tools/verify_rebuilt_moves.js`は41 generator/classを見る恒久形になり、次にこのフェーズ以降で専用技を足しても手直し不要。
- `03-03-PLAN.md` Task 1（実走行の合否を初めて持つ場所）は、今回追加した2本を含む5本全部を対象にしてよい状態。今回の実走行ログ（記録専用）ではすなかけ 5〜8回・斎藤尻隠れ 1〜6回、いずれの技も較正2シード・既定ロスターの3列全てで1回以上発動しており、現時点で0回の技はない。

## NGSD自己採点（掟7）

- **課金加重コスト（主指標）**：`ngsd score`コマンドがこの実行環境（gsd-executorサブエージェント、独立ツールセット）のPATH上に存在せず、算出できなかった。**守れなかった規約として明記する**（03-01と同じ制約）。
- **生トークン**：代替指標として、実際に変更した意味のあるコンテンツの文字数ベースの見積り（`actuals.tokens: 3169` = ソースコード3ファイルの`git diff`文字数11558 ＋ `library.json`のレコード単位の意味のある差分1117文字、を4で割った値）を記録した。`data/moves/library.json`は1行67KBのminifiedファイルのため、素朴な`git diff`はファイル全体が置き換わったように見えるが、実際に変わったのはすなかけの差分439文字（160→599）＋斎藤尻隠れの新規678文字のみで、レコード単位で測った。
- **守れなかった規約**：(1) 上記のNGSDスコア算出ツール不在。(2) 実行の一番最初（`<step name="record_start_time">`相当）で開始時刻を記録し損ね、Task 1コミットまでの読み込み〜実装フェーズの所要時間を正確に計測できなかった（コミット間隔9分9秒は正確だが、これは`git status --short`確認からTask 1コミットまでの区間を含んでいない）。
- **空振りしたゲート**：無し。Task 1/Task 2の`<verify>`が意図的に`verify_rebuilt_moves.js`を含まなかった設計（Task 3で直す前提の「まだ赤でよい」区間）はプラン本文どおりで、空振りではなく設計どおりの一時的な既知の赤。Task 3で通しで走らせた時点では、新規2クラス自体は一度も赤を出していない（検査を緩めて通した箇所は0件）。

## Self-Check: PASSED

- FOUND: src/fx_rebuilt_moves.js (class SandAttackMoveFX / class SaitoButtHideMoveFX / REBUILT_MOVE_META・REBUILT_MOVE_FXの2エントリずつ)
- FOUND: src/anims_rebuilt_moves.js (saito_butt_hide_move キー)
- FOUND: data/moves/library.json (すなかけ made化・斎藤尻隠れ新規)
- FOUND: tools/verify_rebuilt_moves.js (SUPPORT_NAMES/ALL・件数assert4か所導出化)
- FOUND: commit a2d39dd
- FOUND: commit 590af46
- FOUND: commit 9243b80
- CONFIRMED: `node tools/verify_rebuilt_moves.js` exit 0（41 generator/class、非流用、威力連動、決定論、署名一意性）
- CONFIRMED: `node tools/verify_support.js` exit 0（段1が5件・4stat/self・foe網羅）
- CONFIRMED: `node tools/verify_movelist.js` exit 0（made=58件、dist一致）
- CONFIRMED: `node tools/verify_butt_animation.js` exit 0（ビック尻ドロップのゲート無傷）
- CONFIRMED: `workflow.test_command`の8段 + `verify_rebuilt_moves.js` + `check_untouched.js`が全部exit 0
- CONFIRMED: `git status --short`に新しい画像ファイルが0件（掟4）

---
*Phase: 03-five-support-moves*
*Completed: 2026-08-21*
