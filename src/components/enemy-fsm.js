// enemy-fsm.js
export const EnemyStates = {
  IDLE: 'idle',
  PATROL: 'patrol',
  CHASE: 'chase',
  ATTACK: 'attack'
};

export class EnemyFSM {
  constructor(enemy, params) {
    this.enemy = enemy;
    this.params = params;
    this.state = EnemyStates.IDLE;
    this.timer = 0;
  }

  setState(newState) {
    this.state = newState;
    this.timer = 0;
  }

  update(dt) {
    if (!this.params.target || !this.enemy.Parent) return; // ✅ safety guard

    this.timer += dt;

    switch (this.state) {
      case EnemyStates.IDLE:
        if (this.timer > 2) this.setState(EnemyStates.PATROL);
        break;

      case EnemyStates.PATROL:
        if (this.timer > 3) this.setState(EnemyStates.CHASE);
        break;

      case EnemyStates.CHASE: {
        const pos = this.enemy.Parent.Position.clone();
        const dir = this.params.target.Position.clone().sub(pos);
        dir.y = 0;
        if (dir.length() > 0.5) {
          dir.normalize().multiplyScalar(this.params.speed * dt);
          const newPos = pos.add(dir);
          this.enemy.Parent.SetPosition(newPos);
        }
        const distance = this.enemy.Parent.Position.distanceTo(this.params.target.Position);
        if (distance < 2) {
          this.setState(EnemyStates.ATTACK);
        }
        break;
      }

      case EnemyStates.ATTACK:
        console.log("Enemy attacking!");
        if (this.timer > 1) this.setState(EnemyStates.CHASE);
        break;
    }
  }
}
