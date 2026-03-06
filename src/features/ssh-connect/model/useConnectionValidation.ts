import { useMemo } from "react";
import { isValidPort } from "@/shared/lib/constants";

interface ValidationErrors {
  name?: string;
  host?: string;
  port?: string;
  username?: string;
}

interface ValidationParams {
  name: string;
  host: string;
  port: string;
  username: string;
}

const HOST_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

export function useConnectionValidation(
  params: ValidationParams,
  touched: Record<string, boolean>,
): { errors: ValidationErrors; isValid: boolean } {
  return useMemo(() => {
    const errors: ValidationErrors = {};

    if (touched.name) {
      if (!params.name.trim()) {
        errors.name = "Name is required";
      } else if (params.name.length > 50) {
        errors.name = "Max 50 characters";
      }
    }

    if (touched.host) {
      if (!params.host.trim()) {
        errors.host = "Host is required";
      } else if (!HOST_PATTERN.test(params.host)) {
        errors.host = "Invalid host format";
      }
    }

    if (touched.port && !isValidPort(params.port)) {
      errors.port = "Port: 1-65535";
    }

    if (touched.username) {
      if (!params.username.trim()) {
        errors.username = "Username is required";
      }
    }

    const isValid =
      !!params.name.trim() &&
      !!params.host.trim() &&
      !!params.username.trim() &&
      isValidPort(params.port) &&
      Object.keys(errors).length === 0;

    return { errors, isValid };
  }, [params, touched]);
}
