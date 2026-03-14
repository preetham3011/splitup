import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({
  title,
  value,
  subtitle,
  subtitleColor,
  valueColor,
  icon: Icon,
  iconColor,
  iconBg,
}) {
  return (
    <Card className="card-hover border-border/50">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p
              className={cn(
                'text-2xl lg:text-3xl font-bold tracking-tight animate-count',
                valueColor
              )}
            >
              {value}
            </p>
            {subtitle && (
              <p className={cn('text-sm text-muted-foreground', subtitleColor)}>
                {subtitle}
              </p>
            )}
          </div>
          {Icon && (
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: iconBg }}
            >
              <Icon className="w-5 h-5" style={{ color: iconColor }} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
