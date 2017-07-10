#!/bin/bash
madge --image graph.svg --exclude '^(common/broadcast|fruitmix/models/models|fruitmix/lib/paths|fruitmix/middleware/auth)$' src/app.js
