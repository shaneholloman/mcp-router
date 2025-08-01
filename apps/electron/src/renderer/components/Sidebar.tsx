import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  IconSettings,
  IconServer,
  IconActivity,
  IconDeviceDesktop,
  IconRobot,
  IconDownload,
  IconFileText,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAuthStore, useWorkspaceStore } from "@/renderer/stores";
import { usePlatformAPI } from "@/main/infrastructure/platform-api";
// @ts-ignore
import iconImage from "../../../../../public/images/icon/icon.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@mcp_router/ui";
import { ChevronDown, Wrench } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@mcp_router/ui";
import { Button } from "@mcp_router/ui";
import { Textarea } from "@mcp_router/ui";
import { toast } from "sonner";

const SidebarComponent: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const isRemoteWorkspace = currentWorkspace?.type === "remote";
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const platformAPI = usePlatformAPI();

  useEffect(() => {
    // Check if an update is available on mount
    platformAPI.packages.system
      .checkForUpdates()
      .then(({ updateAvailable }) => {
        setUpdateAvailable(updateAvailable);
      });

    // Listen for future update availability
    const unsubscribe = platformAPI.packages.system.onUpdateAvailable(
      (available) => {
        setUpdateAvailable(available);
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const handleInstallUpdate = () => {
    platformAPI.packages.system.installUpdate();
  };

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) return;
    setIsSendingFeedback(true);
    try {
      const success = await platformAPI.settings.submitFeedback(
        feedback.trim(),
      );
      if (success) {
        setFeedback("");
        toast.success(t("feedback.sent"));
      } else {
        toast.error(t("feedback.failed"));
      }
    } catch (error) {
      toast.error(t("feedback.failed"));
    } finally {
      setIsSendingFeedback(false);
    }
  };

  return (
    <Sidebar>
      <div className="pt-[50px]" />
      <SidebarHeader>
        <Link
          to="/apps/electron/public"
          className="flex items-center no-underline px-2 py-1"
        >
          <img src={iconImage} className="w-8 h-8 mr-3" alt="Logo" />
          <h1 className="text-xl font-bold tracking-tight">
            {t("home.title")}
          </h1>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {!isRemoteWorkspace && (
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel>
                  <CollapsibleTrigger className="flex flex-row items-center w-full">
                    {t("agents.title")}
                    <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={
                          isAuthenticated
                            ? t("agents.use")
                            : t("agents.loginRequired.featureDescription")
                        }
                        isActive={
                          location.pathname === "/agents/use" ||
                          location.pathname.startsWith("/agents/use/")
                        }
                      >
                        <Link
                          to="/agents/use"
                          className={`flex items-center gap-3 py-5 px-3 w-full ${!isAuthenticated ? "opacity-60" : ""}`}
                        >
                          <IconRobot className="h-6 w-6" />
                          <span className="text-base">{t("agents.use")}</span>
                          {!isAuthenticated && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              Login required
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={
                          isAuthenticated
                            ? t("agents.build")
                            : t("agents.loginRequired.featureDescription")
                        }
                        isActive={
                          location.pathname === "/agents/build" ||
                          location.pathname.startsWith("/agents/build/")
                        }
                      >
                        <Link
                          to="/agents/build"
                          className={`flex items-center gap-3 py-5 px-3 w-full ${!isAuthenticated ? "opacity-60" : ""}`}
                        >
                          <Wrench className="h-6 w-6" />
                          <span className="text-base">{t("agents.build")}</span>
                          {!isAuthenticated && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              Login required
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          )}

          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel>
                <CollapsibleTrigger className="flex flex-row items-center w-full">
                  MCP
                  <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={t("serverList.title")}
                      isActive={location.pathname === "/servers"}
                    >
                      <Link
                        to="/servers"
                        className="flex items-center gap-3 py-5 px-3 w-full"
                      >
                        <IconServer className="h-6 w-6" />
                        <span className="text-base">
                          {t("serverList.title")}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={t("mcpApps.title")}
                      isActive={location.pathname === "/clients"}
                    >
                      <Link
                        to="/clients"
                        className="flex items-center gap-3 py-5 px-3 w-full"
                      >
                        <IconDeviceDesktop className="h-6 w-6" />
                        <span className="text-base">{t("mcpApps.title")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {!isRemoteWorkspace && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={t("rules.title")}
                        isActive={location.pathname === "/rules"}
                      >
                        <Link
                          to="/rules"
                          className="flex items-center gap-3 py-5 px-3 w-full"
                        >
                          <IconFileText className="h-6 w-6" />
                          <span className="text-base">{t("rules.title")}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {!isRemoteWorkspace && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        tooltip={t("serverDetails.requestLogs")}
                        isActive={location.pathname === "/logs"}
                      >
                        <Link
                          to="/logs"
                          className="flex items-center gap-3 py-5 px-3 w-full"
                        >
                          <IconActivity className="h-6 w-6" />
                          <span className="text-base">
                            {t("serverDetails.requestLogs")}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div className="p-3 space-y-2 border-t border-border">
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder={t("feedback.placeholder")}
            className="text-sm"
          />
          <Button
            onClick={handleSubmitFeedback}
            disabled={!feedback.trim() || isSendingFeedback}
            className="w-full"
          >
            {isSendingFeedback ? t("common.loading") : t("common.send")}
          </Button>
        </div>
        <SidebarMenu>
          {updateAvailable && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={t("updateNotification.installNow")}
              >
                <Link
                  to="#"
                  onClick={handleInstallUpdate}
                  className="flex items-center gap-3 py-5 px-3 w-full"
                >
                  <div className="relative">
                    <IconDownload className="h-6 w-6" />
                    <span className="absolute w-2 h-2 bg-red-500 rounded-full top-0 right-0"></span>
                  </div>
                  <span className="text-base">
                    {t("updateNotification.title")}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={t("common.settings")}
              isActive={location.pathname === "/settings"}
            >
              <Link
                to="/settings"
                className="flex items-center gap-3 py-5 px-3 w-full"
              >
                <IconSettings className="h-6 w-6" />
                <span className="text-base">{t("common.settings")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default SidebarComponent;
