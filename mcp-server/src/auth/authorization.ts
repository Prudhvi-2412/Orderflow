export type PermissionLevel = 'READ' | 'WRITE';

export interface AuthContext {
  userId?: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER' | 'ANONYMOUS';
  token?: string;
}

export interface ToolSecurityCheckOptions {
  toolName: string;
  permissionRequired: PermissionLevel;
  authContext?: AuthContext;
  confirmationConfirmed?: boolean;
}

export interface SecurityCheckResult {
  allowed: boolean;
  errorCode?: 'UNAUTHORIZED' | 'FORBIDDEN' | 'CONFIRMATION_REQUIRED' | 'INVALID_ARGUMENTS';
  message?: string;
}

export class MCPAuthorizationManager {
  /**
   * Validate user permissions and human confirmation for MCP tool execution
   */
  validateToolExecution(options: ToolSecurityCheckOptions): SecurityCheckResult {
    const { toolName, permissionRequired, authContext, confirmationConfirmed } = options;

    const userRole = authContext?.role || 'VIEWER';

    // 1. READ Operations: Allowed for VIEWER, OPERATOR, ADMIN
    if (permissionRequired === 'READ') {
      return { allowed: true };
    }

    // 2. WRITE Operations: Restricted to OPERATOR and ADMIN
    if (userRole !== 'ADMIN' && userRole !== 'OPERATOR') {
      return {
        allowed: false,
        errorCode: 'FORBIDDEN',
        message: `Tool '${toolName}' requires ADMIN or OPERATOR role. Current role: '${userRole}'.`
      };
    }

    // 3. Dangerous Write Operations Require Explicit Human Confirmation
    if (!confirmationConfirmed) {
      return {
        allowed: false,
        errorCode: 'CONFIRMATION_REQUIRED',
        message: `Action '${toolName}' requires explicit human confirmation. Set confirmationConfirmed: true to proceed after user approval.`
      };
    }

    return { allowed: true };
  }

  /**
   * Filter sensitive credentials or PII from tool outputs
   */
  sanitizeOutput(data: any): any {
    if (!data) return data;
    const jsonStr = JSON.stringify(data);
    
    // Mask sensitive keys
    const sanitized = jsonStr
      .replace(/"password"\s*:\s*"[^"]+"/gi, '"password":"[REDACTED]"')
      .replace(/"secret"\s*:\s*"[^"]+"/gi, '"secret":"[REDACTED]"')
      .replace(/"jwt"\s*:\s*"[^"]+"/gi, '"jwt":"[REDACTED]"')
      .replace(/"token"\s*:\s*"[^"]+"/gi, '"token":"[REDACTED]"');

    return JSON.parse(sanitized);
  }
}

export const mcpAuthorization = new MCPAuthorizationManager();
