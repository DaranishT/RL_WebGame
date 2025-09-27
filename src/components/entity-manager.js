export const entity_manager = (() => {

  class EntityManager {
    constructor() {
      console.log("EntityManager created");
      this.ids_ = 0;
      this.entitiesMap_ = {};
      this.entities_ = [];
    }

    _GenerateName() {
      return '__name__' + this.ids_;
    }

    Get(n) {
      return this.entitiesMap_[n];
    }

    Filter(cb) {
      return this.entities_.filter(cb);
    }

    Add(e, n) {
      this.ids_ += 1;

      if (!n) {
        n = this._GenerateName();
      }

      this.entitiesMap_[n] = e;
      this.entities_.push(e);

      e.SetParent(this);
      e.SetName(n);
      e.SetId(this.ids_);
      e.InitEntity();
      
      console.log(`Entity added: ${n}`);
    }

    Update(timeElapsed) {
      for (let i = 0; i < this.entities_.length; ++i) {
        const e = this.entities_[i];
        e.Update(timeElapsed);
      }
    }
  }

  return {
    EntityManager: EntityManager
  };
})();
