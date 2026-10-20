---
title: Data management
sidebar_position: 3
---

Data is organized into datasets containing named numeric columns. Each series selects its X and Y columns from a dataset. Multiple series can share columns, and multiple charts in the same context can use the same dataset.

Use `setData` to replace a dataset with a historical recording. Use `appendData` to add incoming batches while preserving the existing data. Both paths use the same dataset definition, so an application can load history and then continue streaming without changing its chart setup.

Set a maximum sample count for every dataset. It defines the retained data window: when an appended batch would exceed the limit, the oldest samples are removed first (FIFO). This gives streaming applications predictable memory use while retaining the newest data. The maximum can be increased during the dataset lifetime, but it cannot be reduced.

For ordered data, set the column's data pattern to progressive for increasing values or regressive for decreasing values. Configure this separately for each column; leave it unspecified for unordered values.
