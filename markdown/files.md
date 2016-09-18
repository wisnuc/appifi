# Folders and Files

In file system, folder is just a special kind of file.

It contains information (metadata) of files and folders inside it, including but not limited to filename, size, ownership and permissions, timestamp, etc.

Many file or folder operations are actually an operation on their parent folder. Also, the operation are allowed or disallowed by the permission setting of their **PARENT FOLDERS**, rather than theirs. This is crucial for understanding the permission system and files api design.


|   operation   | meaning | permission | api |
|---------------|---------|------------|-----|
| create folder | creating a new record in parent folder | w parent folder | parent folder id, post |
| create file   | creating a new record in parent folder | w parent folder | parent folder id, post, multipart formdata, name etc. |
| rename folder | update a record in parent folder | w parent folder | current folder id, post, '/rename' in url, new name |
| rename file   | update a record in parent folder | w parent folder | current file id, post, '/rename' in url, new name |
| delete folder | delete a record in parent folder | w parent folder | current folder id, delete |
| delete file   | delete a record in parent folder | w parent folder | current file id, delete |
| read folder (list) | read all records in given folder | r current folder | current folder id, get |
| read file | read the data (not metadata) of given file | r current file | current file id, get (download) |
| write file | overwrite the data of given file | w current file | current file id, post, multipart formdata, '/write' in url |

**Examples**

Renaming or deleting a file/folder does NOT require the w permission of the file or folder. The permission on their parent folder suffice.

A user has no permission of a folder or file can get its metadata when listing its parent folder, as long as he/she has the r permission on that folder. He/she can even rename or delete this folder or file.

**Notes**

There are two different ways to upload a file, by creating a file or writing to a file.

The assumption for the former is that the client thinks there does not exist a file with the same name with the file to be uploaded. If this assumption is not correct, the api fails.

The assumption for the latter is that the file with the same name (uuid in our case) do exist on server. Uploading a new version of the file should overwrite the existing one and preserve the name (uuid). If the file dose not exist, the api fails.

When batching upload a lot of file (and folders), the client should always starts from the `creating file` api, if that fails, there are two possibilities:

1. using `creating file` api again and try another file names, which means `auto rename but preserve both copies`. This is the most frequently used strategy for uploading or merging folders.

2. switch to `write file` api, which means `overwrite`. This should be the strategy with **EXPLICIT** user conformation.

Another case worth mentioning is, when a single file is shared to another user, but not it's parent folder.

Then, according to above design, the recipient (sharee is a weird word and seldom used) can **NOT** rename or delete it, but he/she can overwrite it by the `write file` api if he/she has the w permission of the file.
