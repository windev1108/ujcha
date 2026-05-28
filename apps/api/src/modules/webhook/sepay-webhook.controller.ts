import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SepayWebhookPayloadDto } from './dto/sepay-webhook-payload.dto';
import { SepayWebhookService } from './sepay-webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class SepayWebhookController {
  constructor(private readonly service: SepayWebhookService) {}

  @Post('sepay')
  @HttpCode(200)
  @ApiOperation({
    summary: 'SePay payment webhook',
    description:
      'Nhận thông báo giao dịch từ SePay. Tự động đối soát paymentCode trong nội dung CK và cập nhật trạng thái đơn hàng.',
  })
  async handleSepayWebhook(
    @Body() payload: SepayWebhookPayloadDto,
    @Headers('authorization') authHeader: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(payload);
    return this.service.handle(payload, rawBody, authHeader);
  }
}
