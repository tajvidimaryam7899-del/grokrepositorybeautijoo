import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class SetCommissionRateDto {
  @ApiProperty({ description: 'Platform commission rate as a percent, 0-100, up to 2 decimals', example: 10 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate!: number;
}
