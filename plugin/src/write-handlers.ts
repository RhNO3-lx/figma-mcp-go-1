import { handleWriteCreateRequest } from "./write-create";
import { handleWriteModifyRequest } from "./write-modify";
import { handleWriteStyleRequest } from "./write-styles";
import { handleWriteVariableRequest } from "./write-variables";
import { handleWriteComponentRequest } from "./write-components";
import { handleWritePrototypeRequest } from "./write-prototype";
import { handleWriteHistoryRequest } from "./write-history";

export const handleWriteRequest = async (request: any) =>
  (await handleWriteHistoryRequest(request)) ??
  (await handleWriteCreateRequest(request)) ??
  (await handleWriteModifyRequest(request)) ??
  (await handleWriteStyleRequest(request)) ??
  (await handleWriteVariableRequest(request)) ??
  (await handleWriteComponentRequest(request)) ??
  (await handleWritePrototypeRequest(request));
