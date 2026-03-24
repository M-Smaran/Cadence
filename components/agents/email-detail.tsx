import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProcessedEmail } from "@/db/schema";

export function EmailDetail({ email }: { email: ProcessedEmail }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium">
            {email.subject ?? "(No subject)"}
          </CardTitle>
          {email.priority && (
            <Badge
              variant={email.priority === "high" ? "destructive" : "secondary"}
            >
              {email.priority}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          From: {email.from} &middot; {new Date(email.processedAt).toLocaleString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {email.summary && <p className="text-muted-foreground">{email.summary}</p>}
        <div className="flex flex-wrap gap-2">
          {email.category && <Badge variant="outline">{email.category}</Badge>}
          {email.draftCreated && <Badge variant="outline">Draft created</Badge>}
          {!!email.tasksCreated && (
            <Badge variant="outline">{email.tasksCreated} task{email.tasksCreated > 1 ? "s" : ""}</Badge>
          )}
          {!!email.eventsCreated && (
            <Badge variant="outline">{email.eventsCreated} event{email.eventsCreated > 1 ? "s" : ""}</Badge>
          )}
        </div>
        {email.status === "error" && email.error && (
          <p className="text-xs text-destructive">{email.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
