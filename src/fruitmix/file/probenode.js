
class STM {
	constructor(){}

	setState(NextState){
		this.destructor();
		return new NextState();
	}
}

class IdleState extends STM {
	constructor(){
		super();
	}

	requestProbe(){
		return this.setState(WaitingState);
	}

	cancelProbe(){}

	destructor(){}
}

class WaitingState extends STM {
	constructor(){
		super();
		this.timer = setTimeout(() =>
			this.setState(ProbingState), 50);
	}

	requestProbe(){
		return this.setState(WaitingState);
	}

	cancelProbe(){}


	destructor(){
		clearTimeout(this.timer);
	}
}

class ProbingState extends STM {
	constructor(){
		super();
		this.again = false;
		setTimeout(() => {
			this.again ? this.setState(WaitingState) : this.setState(IdleState);
		}, 300);
	}

	requestProbe(){
		this.again = true;
		return this;
	}

	cancelProbe(){}

	destructor(){}
}

class Node {

	constructor(){}

	initProbe(){
		this.probeSTM = new IdleState();
		this.requestProbe = this.probeSTM.requestProbe();
		this.cancelProbe = this.probeSTM.cancelProbe();
	}

	clearProbe(){
		delete this.probeSTM;
		delete this.requestProbe;
		delete this.cancelProbe;
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////

class ProbeSTM {

	constructor(){
		this.state = 'Idle';
	}

	simProbe(cb){
		setTimeout(() => cb(), 300);
	}

	enterIdle(){
		this.state = 'Idle';
	}

	exitIdle(){}

	enterWaiting(){
		this.timer = setTimeout(() =>
			this.setState('Probing'), 50);
	}

	exitWaiting(){
		clearTimeout(this.timer);
		delete this.timer;
	}

	enterProbing(){
		this.again = false;
		this.simProbe(() =>
			this.again ? this.setState('Waiting') : this.setState('Idle'));
	}

	exitProbing(){
		delete this.again;
	}

	setState(nextState){
		let exit = 'exit' + this.state;
		let enter = 'enter' + nextState;
		if(this[exit]) this[exit]();
		this.state = nextState;
		if(this[enter]) this[enter]();
	}

	requestProbe(callback){
		switch(this.state){
		case 'Idle':
			this.setState('Waiting');
			break;
		case 'Waiting':
			this.setState('Waiting');
			break;
		case 'Probing':
			this.again = true;
			break;
		default:
			callback(new Error('invalid probe state'));
		}
		return this;
	}

	cancelProbe(callback){
		let exit = 'exit' + this.state;
		if(this[exit]) this[exit]();
		// this.deleteNode();
		callback(null);
	}

}

class Noded {

	constructor(){}

	initProbe(){
		this.probeSTM = new ProbeSTM();
		this.requestProbe = this.probeSTM.requestProbe(callback);
		this.cancelProbe = this.probeSTM.cancelProbe(callback);
	}

	clearProbe(){
		delete this.probeSTM;
		delete this.requestProbe;
		delete this.cancelProbe;
	}
}