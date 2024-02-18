import { ToastType } from "../toast/toast-type.enum";

export class NotificationMessage {
  public id: number;
  constructor(
    public title: string,
    public message: string,
    public type: ToastType,
    public duration: number = 2000
  ) {
    this.id = new Date().getTime();
  }
}