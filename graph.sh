#!/bin/bash
madge --image graph.svg --exclude '^(reducers|common/async|fruitmix/models/models|fruitmix/lib/paths|fruitmix/middleware/auth)$' src/app.js
