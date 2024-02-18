export class ProgressResult<T> {
    id: string;
    progress: number;
    result: T = null;
    constructor(id: string) {
      this.id = id;
      this.progress = 0;
      this.result = null;
    }
  }