---
title: Configuring axes
sidebar_position: 6
---

Set an axis interval to show a specific range immediately. You can also set a default interval, including a trailing length for a live view that follows newly arriving data.

Axis labels support three value formats:

- Numeric values
- Date and time values, represented as Unix timestamps in milliseconds
- Time durations, represented as milliseconds

As data changes, choose an axis behavior that fits the view:

- **Scrolling** keeps a fixed interval and moves it to the newest data.
- **Fitting** scales the axis to include all available data.
- **Expansion** grows the interval for new extremes without shrinking it.

Each chart automatically creates a default X axis and a default Y axis. Configure them through `DefaultAxisX` and `DefaultAxisY` in C#, or `defaultAxisX` and `defaultAxisY` in Flutter. Their names are optional. Setting `Opposite` / `opposite` to true places the default X axis at the top or the default Y axis on the right.

Add further X or Y axes through the chart's axes configuration. Each additional axis has an ID and an X or Y orientation. Its optional stack index selects the plot section, while its parallel index positions it alongside other axes in that section. The opposite setting selects the top side for X axes or the right side for Y axes.

Assign a series to an additional axis using `XAxisId` / `YAxisId` in C#, or `xAxisId` / `yAxisId` in Flutter. Omitted axis IDs use the corresponding default axes.

For interval, tick-strategy, and scroll-strategy operations, select a default axis by its X or Y target, or an additional axis by its ID.

An axis interval sets the range displayed immediately. A default interval defines the range used when the axis resets or follows incoming data; it can be configured for either a default or an additional axis.
