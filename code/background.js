// Background script for 5LATE extension

// Handle toolbar icon click - open sidebar.html in new tab
browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({
    url: browser.runtime.getURL("sidebar.html?mode=tab")
  });
});
