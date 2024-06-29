/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";

import {
    ElemHideEmulation
}
from "adblockpluscore/lib/content/elemHideEmulation.js";

import {
    ignoreNoConnectionError
} from "../errors.js";
import {
    startElementCollapsing,
    hideElement,
    unhideElement
}
from "./element-collapsing.js";
import {
    startOneClickAllowlisting
} from "./allowlisting.js";
import {
    ElementHidingTracer
} from "./element-hiding-tracer.js";
import {
    subscribeLinksEnabled,
    handleSubscribeLinks
} from "./subscribe-links.js";

let tracer;
let elemHideEmulation;

async function initContentFeatures() {
    if (subscribeLinksEnabled(window.location.href)) {
        handleSubscribeLinks();
    }

    let response = await ignoreNoConnectionError(
        browser.runtime.sendMessage({
            type: "ewe:content-hello"
        })
    );

    if (response) {
        await applyContentFeatures(response);
    }
}

async function removeContentFeatures() {
    if (tracer) {
        tracer.disconnect();
    }
}

async function applyContentFeatures(response) {
    if (response.tracedSelectors) {
        tracer = new ElementHidingTracer(response.tracedSelectors);
    }

    const hideElements = (elements, filters) => {
        for (let element of elements) {
            hideElement(element, response.cssProperties);
        }

        if (tracer) {
            tracer.log(filters);
        }
    };

    const unhideElements = elements => {
        for (let element of elements) {
            unhideElement(element);
        }
    };

    const removeElements = (elements, filters) => {
        for (const element of elements) {
            element.remove();
        }

        if (tracer) {
            tracer.log(filters);
        }
    };

    const applyInlineCSS = (elements, cssPatterns) => {
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const pattern = cssPatterns[i];

            for (const [key, value] of Object.entries(pattern.css)) {
                element.style.setProperty(key, value, "important");
            }
        }

        if (tracer) {
            const filterTexts = cssPatterns.map(pattern => pattern.text);
            tracer.log(filterTexts);
        }
    };

    if (response.emulatedPatterns.length > 0) {
        if (!elemHideEmulation) {
            elemHideEmulation = new ElemHideEmulation(hideElements, unhideElements,
                removeElements, applyInlineCSS);
        }
        elemHideEmulation.apply(response.emulatedPatterns);
    } else if (elemHideEmulation) {
        elemHideEmulation.apply(response.emulatedPatterns);
    }
}

function onMessage(message) {
    if (typeof message == "object" && message != null &&
        message.type && message.type == "ewe:apply-content-features") {
        removeContentFeatures();
        applyContentFeatures(message);
    }
}
browser.runtime.onMessage.addListener(onMessage);

startElementCollapsing();
startOneClickAllowlisting();
initContentFeatures();