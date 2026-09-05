        { booking: { customer: { phone: { contains: term } } } },
        { booking: { customer: { profile: { displayName: { contains: term, mode: 'insensitive' } } } } },
        { booking: { professional: { title: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sortDir },
        include: {
          booking: {
            select: {
              id: true,
              totalPrice: true,
              status: true,
              startAt: true,
              customer: {
                select: {
                  id: true,
                  phone: true,
                  profile: { select: { displayName: true } },
                },
              },
              professional: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Financial Transaction / Payment Detail
   */
  async getFinancialTransactionDetail(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            customer: {
              select: {
                id: true,
                phone: true,
                profile: { select: { displayName: true } },
              },
            },
            professional: {
              select: {
                id: true,
                title: true,
                slug: true,
                user: { select: { phone: true } },
              },
            },
            location: {
              select: {
                id: true,
                name: true,
                address: true,
                city: true,
                province: true,
              },
            },
            items: {
              include: {
                service: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('تراکنش مالی یافت نشد');
    }

    return {
      ...payment,
      isCommissionSnapshotted: payment.platformCommissionRate !== null,
      providerNote: 'Mock / Test Payment Provider',
      refundStatus: 'Not Implemented',
    };
  }

  /**
   * Get current Commission Setting
   */
  async getCommissionSetting() {
    let rate = DEFAULT_PLATFORM_COMMISSION_RATE;
    let updatedAt: Date | null = null;

    try {
      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: PLATFORM_COMMISSION_RATE_KEY },
      });
      if (setting && setting.value !== null && setting.value !== undefined) {
        const val = typeof setting.value === 'number'
          ? setting.value
          : (typeof setting.value === 'object' && 'rate' in (setting.value as any))
            ? Number((setting.value as any).rate)
            : Number(setting.value);
        if (!isNaN(val) && val >= 0 && val <= 100) {
          rate = val;
          updatedAt = setting.updatedAt;
        }
      }
    } catch {
      rate = DEFAULT_PLATFORM_COMMISSION_RATE;
    }

    return {
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate,
      defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE,
      updatedAt,
      notice: 'تغییر نرخ کارمزد فقط بر تراکنش‌های آینده اعمال شده و Snapshot تراکنش‌های گذشته بدون تغییر باقی می‌ماند.',
    };
  }

  /**
   * Update Commission Setting with Audit Log
   */
  async updateCommissionSetting(newRate: number, adminUserId?: string) {
    if (typeof newRate !== 'number' || isNaN(newRate) || newRate < 0 || newRate > 100) {
      throw new BadRequestException('نرخ کارمزد باید عددی بین ۰ تا ۱۰۰ باشد.');
    }

    // Keep max 2 decimal places deterministically
    const roundedRate = Math.round(newRate * 100) / 100;

    const oldSetting = await this.getCommissionSetting();

    const updated = await this.prisma.platformSetting.upsert({
      where: { key: PLATFORM_COMMISSION_RATE_KEY },
      update: {
        value: { rate: roundedRate },
      },
      create: {
        key: PLATFORM_COMMISSION_RATE_KEY,
        value: { rate: roundedRate },
      },
    });

    // Write sensitive action to existing AuditLog model
    await this.prisma.auditLog.create({
      data: {
        actorId: adminUserId || null,
        action: 'UPDATE_COMMISSION_RATE',
        entityType: 'platform_setting',
        entityId: updated.id,
        after: {
          key: PLATFORM_COMMISSION_RATE_KEY,
          previousRate: oldSetting.rate,
          newRate: roundedRate,
          actorRole: 'SUPER_ADMIN',
        },
      },
    });

    return {
      success: true,
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate: roundedRate,
      updatedAt: updated.updatedAt,