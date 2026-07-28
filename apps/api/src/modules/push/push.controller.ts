import { Body, Controller, Delete, Post } from '@nestjs/common';
import { PushService } from './push.service';
import { SubscribePushDto, UnsubscribePushDto } from './dto/subscribe-push.dto';

@Controller('push')
export class PushController {
    constructor(private readonly pushService: PushService) { }

    // Public — member trong group order có thể chưa đăng nhập.
    // Nếu bạn có decorator lấy optional user (vd @OptionalUser()), gắn userId vào đây.
    @Post('subscribe')
    subscribe(@Body() dto: SubscribePushDto) {
        return this.pushService.subscribe(dto);
    }

    @Delete('subscribe')
    unsubscribe(@Body() dto: UnsubscribePushDto) {
        return this.pushService.unsubscribe(dto.endpoint);
    }
}
