import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class ShipperJwtGuard extends AuthGuard('shipper-jwt') {}
