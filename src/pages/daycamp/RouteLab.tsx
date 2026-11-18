import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildPriorsFromBundledMappoint,
  suggestBusForStreet,
} from "@/lib/historicalRouteLearning";

export default function RouteLab() {
  const priors = useMemo(() => buildPriorsFromBundledMappoint("2026"), []);
  const [address, setAddress] = useState("45 Soundview Drive, Port Washington, NY 11050");
  const [query, setQuery] = useState(address);

  const suggestion = useMemo(
    () => (query.trim() ? suggestBusForStreet(query, priors) : null),
    [priors, query],
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Route lab</h1>
        <p className="text-sm text-muted-foreground">
          Test page, off the transport board. A new house on a street that already has campers is suggested for that bus.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Street check</CardTitle>
          <CardDescription>Uses the 2026 MapPoint stops. Nothing here is written to the live routes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(address);
            }}
          >
            <Input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Street address"
              aria-label="Street address"
            />
            <Button type="submit">Check</Button>
          </form>

          {query.trim() && !suggestion ? (
            <p className="text-sm text-muted-foreground">
              No 2026 stop is on that street, so this lab will not guess a bus.
            </p>
          ) : null}

          {suggestion ? (
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Bus {suggestion.busNumber}</span>
                {suggestion.routeName ? ` · ${suggestion.routeName}` : ""}
              </p>
              <p>
                {suggestion.riderCount} camper{suggestion.riderCount === 1 ? "" : "s"} already on {suggestion.street}.
                {suggestion.sampleNames.length ? ` ${suggestion.sampleNames.join(", ")}.` : ""}
              </p>
              {suggestion.farFromBus ? (
                <p className="text-amber-700">
                  That house sits more than a mile and a half from the rest of this bus. Look at a nearer route before assigning it.
                </p>
              ) : (
                <p>This house sits with the rest of that bus.</p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Link to="/" className="text-sm text-muted-foreground underline">
        Back to day camp
      </Link>
    </div>
  );
}
