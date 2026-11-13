import { Spinner } from "@blueprintjs/core";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { Shell } from "./shell/Shell";
import { Automation } from "./views/Automation";
import { CommandCenter } from "./views/CommandCenter";

const Positions = lazy(() =>
  import("./views/Positions").then((found) => ({ default: found.Positions })),
);
const Orders = lazy(() => import("./views/Orders").then((found) => ({ default: found.Orders })));
const OrderBook = lazy(() =>
  import("./views/OrderBook").then((found) => ({ default: found.OrderBook })),
);
const Strategies = lazy(() =>
  import("./views/Strategies").then((found) => ({ default: found.Strategies })),
);
const StrategyDetail = lazy(() =>
  import("./views/Strategies").then((found) => ({ default: found.StrategyDetail })),
);
const Backtesting = lazy(() =>
  import("./views/Backtesting").then((found) => ({ default: found.Backtesting })),
);
const Risk = lazy(() => import("./views/Risk").then((found) => ({ default: found.Risk })));
const Compliance = lazy(() =>
  import("./views/Compliance").then((found) => ({ default: found.Compliance })),
);
const Dashboard = lazy(() =>
  import("./views/Dashboard").then((found) => ({ default: found.Dashboard })),
);
const Reconciliation = lazy(() =>
  import("./views/Reconciliation").then((found) => ({ default: found.Reconciliation })),
);
const Blotter = lazy(() => import("./views/Blotter").then((found) => ({ default: found.Blotter })));
const Markets = lazy(() => import("./views/Markets").then((found) => ({ default: found.Markets })));
const Research = lazy(() =>
  import("./views/Research").then((found) => ({ default: found.Research })),
);
const Settings = lazy(() =>
  import("./views/Settings").then((found) => ({ default: found.Settings })),
);
const Audit = lazy(() => import("./views/Audit").then((found) => ({ default: found.Audit })));
const System = lazy(() => import("./views/System").then((found) => ({ default: found.System })));
const Signals = lazy(() => import("./views/Signals").then((found) => ({ default: found.Signals })));

export function App() {
  return (
    <BrowserRouter basename="/ui">
      <Suspense fallback={<Spinner size={24} />}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<CommandCenter />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="reconciliation" element={<Reconciliation />} />
            <Route path="markets" element={<Markets />} />
            <Route path="positions" element={<Positions />} />
            <Route path="orders" element={<Orders />} />
            <Route path="blotter" element={<Blotter />} />
            <Route path="book" element={<OrderBook />} />
            <Route path="strategies" element={<Strategies />} />
            <Route path="strategies/:name" element={<StrategyDetail />} />
            <Route path="signals" element={<Signals />} />
            <Route path="research" element={<Research />} />
            <Route path="backtesting" element={<Backtesting />} />
            <Route path="risk" element={<Risk />} />
            <Route path="compliance" element={<Compliance />} />
            <Route path="audit" element={<Audit />} />
            <Route path="automation" element={<Automation />} />
            <Route path="system" element={<System />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
