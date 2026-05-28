import { Injectable } from '@nestjs/common';
import { SmsService } from '../../sms/sms.service';

@Injectable()
export class AdminSmsService {
  constructor(private readonly smsService: SmsService) {}

  listLogs(page: number, limit: number, phone?: string) {
    return this.smsService.listLogs(page, limit, phone);
  }
}
