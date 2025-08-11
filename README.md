# AutoplayStopper (Original)
This is the original code of [AutoplayStopper](https://chromewebstore.google.com/detail/autoplaystopper/ejddcgojdblidajhngkogefpkknnebdh) Chrome Extension which is no longer available on the Chrome Web Store.

This extension is Manifest V2 based and is no longer compatible with Chrome 104+.

**Feel free to fork this repo and update it to Manifest V3.**

# Overview
Stops video autoplay gracefully.

Make video players (flash & html5) show video thumbnail instead of autoplaying…

**IMPORTANT NOTICE**: some video conferencing sites will only work if they are allowed to autoplay...

If videos still autoplay try enabling proactive blocking for the site by either
    Clicking the 'Allow autoplay for...' menuitem until it's highlighted dark red.
    Adding 'Block (shadow)' autoplay exception for the site from the settings.

Features:

* Allow autoplay for websites
* Enable proactive blocking for websites
       Stop media autoplay in shadow dom (performance impact)
* Allow session autoplay for websites
       Stop only first autoplay for a continuous session in the website (for video sites like Dailymotion)
* Disable flash detection for websites
       Force sites to use their html5 player which can always be stopped.
* Quick add-on enable/disable (left-dblclick)
* Play/Pause context menu item will show for covered video elements (ctrl+right-click to ensure default context)

## Release Notes:

Version 1.9.8.1  10/9/2023
* Fixed popup menu.

Version 1.9.8  7/12/2022
* Fixed shadow for msn.

Version 1.9.7  6/9/2022
* Fixed context menu & popup.

Version 1.9.6  13/7/2022
* Added proactive blocking.

Version 1.9.5  25/2/2022
* Added exceptions import/export.

Version 1.9.4  26/7/2021
* tweaks...

Version 1.9.3  1/6/2021
* Improved jwplayer handling.

Version 1.9.1  14/3/2021
* Improved youtube handling.

Version 1.9.0  23/2/2021
* Added keyboard activation.
* Improved youtube handling.
* Improved site permissions interaction.

Version 1.8.7  30/1/2021
* Added deep nodes handling.

Version 1.8.5  17/1/2021
* Added strict blocking mode.
* Improved play rejection.

