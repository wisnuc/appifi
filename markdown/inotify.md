## access (not used)
A watched file or a file within a watched directory was read from.

## modify
A watched file or a file within a watched directory was written to.

## attrib
The metadata of a watched file or a file within a watched directory was modified.  This includes timestamps, file permissions, extended attributes etc.

## close_write
A watched file or a file within a watched directory was closed, after being opened in writeable mode.  This does not necessarily imply the file was written to.

## close_nowrite
A watched file or a file within a watched directory was closed, after being opened in read-only mode.

## close  
A watched file or a file within a watched directory was closed, regardless of how it was opened.  Note that this is actually implemented simply by listening for both close_write and close_nowrite, hence all close events received will be output as one of these, not CLOSE.

## open   
A watched file or a file within a watched directory was opened.

## moved_to
A file or directory was moved into a watched directory.  This event occurs even if the file is simply moved from and to the same directory.

## moved_from
A file or directory was moved from a watched directory.  This event occurs even if the file is simply moved from and to the same directory.

## move   
A  file or directory was moved from or to a watched directory.  Note that this is actually implemented simply by listening for both moved_to and moved_from, hence all close events received will be output as one or both of these, not MOVE.

## move_self
A watched file or directory was moved. After this event, the file or directory is no longer being watched.

## create
A file or directory was created within a watched directory.

## delete
A file or directory within a watched directory was deleted.

## delete_self
A watched file or directory was deleted.  After this event the file or directory is no longer being watched.  Note that this event can occur even if it is not explicitly being listened for.

## unmount
The filesystem on which a watched file or directory resides was unmounted.  After this event the file or directory is no longer being watched.  Note that this event can occur even if it is not explicitly being listened to.
