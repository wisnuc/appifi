

class ModelService {

	createLocalUser(user, props, callback) {
		// check permission
		// check args
		// dispatch
	}

	createRemoteUser(user, props, callback) {}

	updateLocalUser(user, props, callback) {}

	updateRemoteUser(user, props, callback) {}

	updatePassword(user, password, callback) {}

	// friends is an array
	createFriend(user, friends, callback) {}

	// friends is an array
	deleteFriend(user, friends, callback) {}

	createPublicDrive(user, props, callback) {}

	updatePublicDrive(user, props, callback) {}

	deletePublicDrive(user, driveuuid, callback) {}
}