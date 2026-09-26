/*
 * RESULT
 *   Chrome version: 154.0.0.0, Windows, tested 2026-09-26
 *   Run 1: FAILS at step 1, "Extension has not been invoked for the current
 *          page (see activeTab permission)."
 *   Run 2: FAILS at step 1, same error. A button press inside the panel does
 *          not count as invoking the extension.
 *   Run 3: WORKS at step 2, 1 audio track. The service worker got the id
 *          inside action.onClicked and the side panel redeemed it.
 *   Conclusion for LOS-10: Plan A. The side panel can consume a stream id,
 *          but only one requested by the service worker inside the icon
 *          click. Replace openPanelOnActionClick with action.onClicked +
 *          sidePanel.open. No offscreen document needed. */