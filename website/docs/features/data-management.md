---
title: Data management
sidebar_position: 3
---

Data is organized into datasets. A dataset contains one shared X column and one or more named Y columns, which makes it efficient to visualize many synchronized signals. A channel can render any Y column from a dataset, and multiple charts in the same context can use that dataset.

Use `setData` to replace a dataset with a historical recording. Use `appendData` to add incoming batches while preserving the existing data. Both paths use the same dataset definition, so an application can load history and then continue streaming without changing its chart setup.

Set a maximum sample count for every dataset. It defines the retained data window: when an appended batch would exceed the limit, the oldest samples are removed first (FIFO). This gives streaming applications predictable memory use while retaining the newest data. The maximum can be increased during the dataset lifetime, but it cannot be reduced.

For ordered data, declare whether X values or Y-column values are progressive or regressive. These hints help the renderer handle sequential data efficiently.
