---
title: LCLA Context
sidebar_position: 2
---

An `LclaContext` is the shared charting environment for a client application. It owns the connection to the renderer, the available datasets, and any charts created from it. Create one context, then create as many charts as your application needs. This lets charts use the same data without copying it for every view.

Every context requires an `LclaLicense`. Supply a LightningChart JS license key when creating it. Application deployment licenses can also include the application title and company information.

:::note
Flutter currently uses a different model: create charts directly, with each chart acting as its own context. Consequently, Flutter can only support up to 16 charts at once.
:::
