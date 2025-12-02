import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function useServiceWorkerUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW();

  return { needRefresh, updateServiceWorker };
}
