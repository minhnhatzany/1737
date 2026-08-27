# Onboarding QA Checklist (10-minute test)

## Scope
- Platform: desktop web + mobile web.
- Build: run from `RUN_GAME.bat`.
- Save state: fresh run (clear local save before test).

## Functional checks
- Character creation starts game normally after selecting name/gender/traits.
- Tutorial modal opens on first run and pauses time while open.
- Interactive tutorial steps can advance without missing selector errors.
- The step for market trade can be completed by clicking a buy/sell button.
- The map step highlights a real target and can advance.

## Discoverability checks
- Unseen tabs (`Chợ`, `Bản Đồ`, `Lối Sống`, `Xã Hội`) show `NEW` badge.
- Clicking a tab clears its `NEW` badge and keeps others intact.
- On mobile, tab bar shows overflow indicator when more tabs exist to the right.
- On mobile, tab order starts with `Hoạt Động`, `Chợ`, `Bản Đồ`, `Lối Sống`.
- `Bước tiếp theo cho người mới` panel updates progress and CTA buttons correctly.

## Quest funnel checks
- Fresh save contains onboarding quests for market/map/lifestyle discovery.
- Opening `Chợ` completes quest `Làm Quen Sàn Chợ`.
- Completing first trade completes `Mua Bán Mở Hàng`.
- Opening `Bản Đồ` and traveling once completes map/travel quests.
- Choosing a lifestyle focus completes `Định Hướng Cuộc Đời`.

## Contextual hint checks
- With enough money and unseen market tab, a hint suggests opening `Chợ`.
- With unseen map tab and enough stamina, a hint suggests opening `Bản Đồ`.
- With available lifestyle points and no focus, a hint suggests opening `Lối Sống`.
- Invalid actions show guidance in the error text (not only a hard fail).

## Metrics to capture after release
- Percent of new players opening `Chợ` within 10 minutes.
- Percent of new players opening `Bản Đồ` within 10 minutes.
- Percent of new players doing first trade within 10 minutes.
- Percent of new players selecting lifestyle focus within 10 minutes.
- Median time-to-first-travel and time-to-first-trade.
