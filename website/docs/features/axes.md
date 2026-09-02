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

Channels can share the default Y axis or be assigned to stacked Y axes. Put signals with different units or scales on separate stacked axes while they retain a common X axis. Axis intervals, label formats, and behavior can be configured separately for each stacked Y axis.
