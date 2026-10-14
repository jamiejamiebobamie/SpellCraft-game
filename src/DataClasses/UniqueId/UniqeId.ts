export class UniqueId {
  id!: string;
  constructor() {
    this.id = crypto.randomUUID();
  }
}