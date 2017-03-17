import DirectoryNode from './directoryNode'

class DriveNode extends DirectoryNode {

  constructor(ctx, xstat, drive) {
    super(ctx, xstat)
    this.drive = drive
  }

  updateDrive(drive) {
    this.drive = drive
  }
}

export default DriveNode

