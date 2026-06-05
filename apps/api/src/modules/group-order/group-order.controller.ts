import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GroupOrderGateway } from './group-order.gateway';
import { GroupOrderService } from './group-order.service';
import {
  ConfirmPaidDto,
  CreateGroupOrderDto,
  JoinGroupOrderDto,
  PaymentActionDto,
  SessionActionDto,
  SetFulfillmentDto,
  UpdateGroupOrderConfigDto,
  UpdateItemsDto,
} from './dto/group-order.dto';

@ApiTags('group-orders')
@Controller('group-orders')
export class GroupOrderController {
  constructor(
    private readonly service: GroupOrderService,
    private readonly gateway: GroupOrderGateway,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: any, @Body() dto: CreateGroupOrderDto) {
    const result = await this.service.create(req.user.userId as string, dto);
    return result;
  }

  @Get(':token')
  getState(@Param('token') token: string) {
    return this.service.findByToken(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':token/join')
  @HttpCode(200)
  async join(
    @Param('token') token: string,
    @Req() req: any,
    @Body() dto: JoinGroupOrderDto,
  ) {
    const result = await this.service.join(token, req.user.userId as string, dto);
    const state = await this.service.findByToken(token);
    this.gateway.broadcast(token, state);
    return result;
  }

  @Put(':token/items')
  async updateItems(
    @Param('token') token: string,
    @Body() dto: UpdateItemsDto,
  ) {
    const state = await this.service.updateItems(token, dto.sessionToken, dto.items);
    this.gateway.broadcast(token, state);
    return state;
  }

  @Post(':token/ready')
  @HttpCode(200)
  async markReady(
    @Param('token') token: string,
    @Body() dto: SessionActionDto,
  ) {
    const state = await this.service.markReady(token, dto.sessionToken);
    this.gateway.broadcast(token, state);
    return state;
  }

  @Post(':token/lock')
  @HttpCode(200)
  async lock(
    @Param('token') token: string,
    @Body() dto: SessionActionDto,
  ) {
    const state = await this.service.lock(token, dto.sessionToken);
    this.gateway.broadcast(token, state);
    return state;
  }

  @Post(':token/unlock')
  @HttpCode(200)
  async unlock(
    @Param('token') token: string,
    @Body() dto: SessionActionDto,
  ) {
    const state = await this.service.unlock(token, dto.sessionToken);
    this.gateway.broadcast(token, state);
    return state;
  }

  @Patch(':token/fulfillment')
  @HttpCode(200)
  async setFulfillment(
    @Param('token') token: string,
    @Body() dto: SetFulfillmentDto,
  ) {
    const state = await this.service.setFulfillment(token, dto.sessionToken, dto);
    this.gateway.broadcast(token, state);
    return state;
  }

  @Post(':token/checkout')
  @HttpCode(200)
  async checkoutHostPays(
    @Param('token') token: string,
    @Body() dto: PaymentActionDto,
  ) {
    const result = await this.service.checkoutHostPays(
      token,
      dto.sessionToken,
      dto.paymentType,
    );
    this.gateway.broadcast(token, result.groupOrder);
    return result;
  }

  @Post(':token/split-payment')
  @HttpCode(200)
  async initSplitPayment(
    @Param('token') token: string,
    @Body() dto: PaymentActionDto,
  ) {
    const state = await this.service.initSplitPayment(
      token,
      dto.sessionToken,
      dto.paymentType,
    );
    this.gateway.broadcast(token, state);
    return state;
  }

  @Post(':token/confirm-paid')
  @HttpCode(200)
  async confirmPaid(
    @Param('token') token: string,
    @Body() dto: ConfirmPaidDto,
  ) {
    const state = await this.service.confirmParticipantPaid(
      token,
      dto.participantId,
      dto.sessionToken,
    );
    this.gateway.broadcast(token, state);
    return state;
  }

  @Post(':token/checkout-split-cash')
  @HttpCode(200)
  async checkoutSplitCash(
    @Param('token') token: string,
    @Body() dto: SessionActionDto,
  ) {
    const result = await this.service.checkoutSplitCash(token, dto.sessionToken);
    this.gateway.broadcast(token, result.groupOrder);
    return result;
  }

  @Get('config/discount')
  getConfig() {
    return this.service.getConfig();
  }

  @UseGuards(JwtAuthGuard)
  @Put('config/discount')
  updateConfig(@Body() dto: UpdateGroupOrderConfigDto) {
    return this.service.updateConfig({
      isEnabled: dto.isEnabled,
      discountTiers: dto.discountTiers,
    });
  }
}
