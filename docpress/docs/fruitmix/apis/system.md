## boot

### GET /boot


### POST /boot

request body example:

```json
{
  "op": "boot",
  "target": "0dd89cb1-f02e-455d-875c-bbe2ebc9329f", 
}
```

**op** is a string, mandatory, valid values are:

* `poweroff`
* `reboot`
* `rebootMaintenance`
* `rebootNormal`

**target** is a string, optional, may be used for `rebootNormal`, if it is provided, both it's value, and the requested operation, must be valid. Otherwise, an error is returned.

`poweroff` and `reboot` will shutdown or reboot the system directly, without any further operations.

`rebootMaintenance` will set the `bootMode` in configuration to `maintenance` first, then reboot the system. The system will boot into `maintenance` mode and stopped there. 

`rebootNormal` will set the `bootMode` in configuration to `normal` first, then reboot the system, if `target` is unset.

If `target` is set, it must represented a file system, either a btrfs volume, or an ext4 / ntfs file system that fruitmix supports. If not, an error is return as 400 with message for reason. No error codes defined for client program, yet.

These apis returns 200, 400, and 500 in general sense.




