
"use client";

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanLine, CheckCircle, AlertTriangle, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface ARScannerPlaceholderProps {
  onCardScanned: (identifiedCardName: string) => void;
}

// 與 public/mindar/index.html 中的 cardNamesInMindAR 保持一致
const knownCardNames: string[] = [
  "社交模擬機",
  "重型作業機",
  "秘密偵察機",
  "數據分析機",
  "簡訊回覆機"
];

export default function ARScannerPlaceholder({ onCardScanned }: ARScannerPlaceholderProps) {
  const { toast } = useToast();
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"success" | "error" | "info" | null>(null);

  const [isRequestingPermission, setIsRequestingPermission] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [isMindARLoading, setIsMindARLoading] = useState(true);
  const mindARReadyTimerRef = useRef<NodeJS.Timeout | null>(null);

  console.log("ARScannerPlaceholder: Render - isMindARLoading:", isMindARLoading, "hasCameraPermission:", hasCameraPermission, "isRequestingPermission:", isRequestingPermission);

  useEffect(() => {
    console.log("ARScannerPlaceholder: Mount/Permission Effect");
    const requestCameraPermission = async () => {
      console.log("ARScannerPlaceholder: Requesting camera permission...");
      setIsRequestingPermission(true);
      setCameraError(null);
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        console.log("ARScannerPlaceholder: Camera permission granted.");
        setHasCameraPermission(true);
      } catch (err: any) {
        console.error("ARScannerPlaceholder: Camera access denied or error:", err);
        setHasCameraPermission(false);
        let errorMessage = `無法存取攝影機。請檢查瀏覽器設定。(${err.name || '未知錯誤'})`;
        if (err.name === "NotAllowedError") {
          errorMessage = "您已拒絕攝影機存取權限。請在瀏覽器設定中允許攝影機存取以使用此功能。";
        } else if (err.name === "NotFoundError") {
          errorMessage = "找不到攝影機。請確認您的裝置已連接攝影機並被系統偵測到。";
        } else if (err.name === "NotReadableError") {
            errorMessage = "攝影機目前可能被其他應用程式使用中，或發生硬體錯誤。";
        }
        setCameraError(errorMessage);
        toast({
          variant: 'destructive',
          title: '攝影機存取錯誤',
          description: '請允許攝影機權限以掃描卡片。如果您已拒絕，請檢查瀏覽器設定。',
        });
      } finally {
        setIsRequestingPermission(false);
        console.log("ARScannerPlaceholder: Camera permission request finished.");
      }
    };

    requestCameraPermission();

    // Cleanup function for this effect if needed
    return () => {
      console.log("ARScannerPlaceholder: Cleanup Mount/Permission Effect");
    };
  }, [toast]); // Only re-run if toast changes

  useEffect(() => {
    console.log("ARScannerPlaceholder: MindAR Setup Effect - hasCameraPermission:", hasCameraPermission);
    if (!hasCameraPermission) {
      console.log("ARScannerPlaceholder: No camera permission, skipping MindAR setup.");
      if (isMindARLoading) {
        // console.log("ARScannerPlaceholder: Setting isMindARLoading to false (no camera permission).");
        // setIsMindARLoading(false); // Keep loading UI until camera error is definitively shown
      }
      return;
    }

    // Reset and start loading MindAR
    console.log("ARScannerPlaceholder: Camera permission OK. Setting isMindARLoading to true and starting MindAR setup.");
    setIsMindARLoading(true); // Explicitly set to true when starting setup
    setScanMessage(null);
    setScanStatus(null);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin && event.origin !== new URL(document.querySelector('iframe')!.src).origin) {
         // For development, you might allow event.origin to be from the iframe's actual origin if it's different
         // console.warn("ARScannerPlaceholder: Received message from iframe with origin:", event.origin, "Expected:", window.location.origin, "or iframe src origin. Data:", event.data);
         // For now, let's be a bit more permissive in dev if the source is from an iframe.
         // In production, ensure this is locked down.
      }

      if (event.data && typeof event.data === 'object') {
        console.log("ARScannerPlaceholder: Received message from iframe:", event.data);
        if (event.data.type === 'mindarReady') {
          console.log("ARScannerPlaceholder: Received 'mindarReady'. Clearing timer.");
          if (mindARReadyTimerRef.current) clearTimeout(mindARReadyTimerRef.current);
          setIsMindARLoading(false);
 clearTimeout(mindARReadyTimerRef.current); // Clear the timeout as MindAR is ready
          setScanMessage("AR 掃描器已準備就緒。請將角色卡對準攝影機。");
          setScanStatus("info");
        } else if (event.data.type === 'mindarScanSuccess') {
          console.log("ARScannerPlaceholder: Received 'mindarScanSuccess'. Clearing timer.");
          if (mindARReadyTimerRef.current) clearTimeout(mindARReadyTimerRef.current);
          if (isMindARLoading) setIsMindARLoading(false);
          const cardName = event.data.cardName as string;

          if (cardName && knownCardNames.includes(cardName)) {
            setScanMessage(`成功辨識卡片：${cardName}！`);
            setScanStatus("success");
            onCardScanned(cardName);
          } else {
            setScanMessage(`收到無法識別的卡片名稱：「${cardName}」。或卡片為「未知卡片」。請確保您的卡片正確，或調整 MindAR 設定。`);
            setScanStatus("error");
            toast({
              variant: 'destructive',
              title: 'AR 辨識問題',
              description: `未能從 AR 辨識出已知的角色卡。收到：「${cardName}」`,
            });
          }
        } else if (event.data.type === 'mindarError') {
          console.log("ARScannerPlaceholder: Received 'mindarError'. Clearing timer.");
          if (mindARReadyTimerRef.current) clearTimeout(mindARReadyTimerRef.current);
          if (isMindARLoading) setIsMindARLoading(false);
          setScanMessage(`AR 掃描器錯誤：${event.data.message || '未知錯誤'}`);
          setScanStatus("error");
          toast({
              variant: 'destructive',
              title: 'AR 掃描器錯誤',
              description: event.data.message || 'MindAR 內部發生未知錯誤。請檢查瀏覽器開發者工具中的 iframe console 以獲取更多資訊。',
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    console.log("ARScannerPlaceholder: Added message event listener.");

    if (mindARReadyTimerRef.current) {
      clearTimeout(mindARReadyTimerRef.current);
      console.log("ARScannerPlaceholder: Cleared old MindAR ready timer before setting new one.");
    }

    mindARReadyTimerRef.current = setTimeout(() => {
        // Check if the component is still mounted and effect is active
        if (mindARReadyTimerRef.current) { // Check if timer is still valid (not cleared)
            console.log("ARScannerPlaceholder: MindAR ready timeout (12 seconds) callback executing. Current isMindARLoading state:", isMindARLoading);
            if(isMindARLoading){ // Only act if still loading
                setIsMindARLoading(false);
                console.log("ARScannerPlaceholder: After setIsMindARLoading(false) in timeout, isMindARLoading should be false for next render.");
                setScanMessage("AR 掃描器啟動超時 (12秒)。\n\n🚨 **主要原因極可能是 `targets.mind` 檔案問題！** 🚨\n\n您在 iframe Console 中看到的 `RangeError: Extra ... byte(s) found at buffer` 錯誤表示 MindAR 無法正確解析 `targets.mind` 檔案。這通常是因為：\n1.  **`targets.mind` 檔案本身已損壞或格式不正確。**\n2.  **版本不相容**：您用來編譯 `targets.mind` 的 MindAR 編譯器版本與 `public/mindar/index.html` 中使用的 MindAR 函式庫版本 (`1.2.5`) 不符。\n\n**解決方案：**\n- **重新編譯 `targets.mind` 檔案**，確保使用與 MindAR `1.2.5` 版函式庫相容的編譯器。\n- **檢查原始圖像**是否清晰且適合 AR 追蹤。\n- **務必打開瀏覽器開發者工具 (按 F12)，在 AR 掃描器（iframe）區域按右鍵選「檢查」，然後查看該 iframe 的「主控台」(Console) 中的詳細 `RangeError` 錯誤。**");
                setScanStatus("error");
                toast({
                    variant: 'destructive',
                    title: 'AR 掃描器超時 - 請檢查 `targets.mind`!',
                    description: 'MindAR 未能準備就緒。極有可能是 `targets.mind` 檔案問題導致的 `RangeError`。請檢查 iframe 的 Console！',
                    duration: 30000, // Longer duration for this critical error
                });
            } else {
                console.log("ARScannerPlaceholder: Timeout callback ran, but isMindARLoading was already false. No state change by timeout itself.");
            }
        }
    }, 12000);
    console.log("ARScannerPlaceholder: Set MindAR ready timer (12s). Timer ID:", mindARReadyTimerRef.current);

    return () => {
      console.log("ARScannerPlaceholder: Cleanup MindAR Setup Effect. Clearing message listener and timer.");
      window.removeEventListener('message', handleMessage);
      if (mindARReadyTimerRef.current) {
        clearTimeout(mindARReadyTimerRef.current);
        console.log("ARScannerPlaceholder: Cleared MindAR ready timer on effect cleanup. Timer ID:", mindARReadyTimerRef.current);
        mindARReadyTimerRef.current = null; // Ensure timer ID is cleared
      }
    };
  }, [hasCameraPermission, onCardScanned, toast]); // Dependency on hasCameraPermission is key


  if (isRequestingPermission) {
    return (
      <Card className="text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center justify-center gap-2 text-primary">
            <Camera className="h-7 w-7 animate-pulse" />
            AR 角色卡掃描器
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 py-10">
            <div className="flex flex-col items-center justify-center space-y-2">
                <ScanLine className="h-10 w-10 text-primary animate-ping" />
                <p className="text-lg font-semibold text-primary">正在請求攝影機權限...</p>
                <p className="text-muted-foreground">請在瀏覽器提示時允許存取您的攝影機。</p>
            </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasCameraPermission) {
    return (
      <Card className="text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center justify-center gap-2 text-destructive">
            <AlertTriangle className="h-7 w-7" />
            攝影機存取失敗
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 py-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>無法啟動攝影機</AlertTitle>
            <AlertDescription>
              {cameraError || "未能獲得攝影機存取權限。請檢查您的瀏覽器設定，確保已允許本網站使用攝影機，然後重新整理頁面。"}
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => window.location.reload()}>
            重新整理頁面
          </Button>
        </CardContent>
      </Card>
    );
  }

  // If we have camera permission, we render the iframe and loading/status messages
  return (
    <Card className="text-center shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center justify-center gap-2 text-primary">
          <Camera className="h-7 w-7" />
          AR 角色卡掃描器
        </CardTitle>
        <CardDescription className="pt-1">
          攝影機已啟用。請將您的角色卡置於攝影機畫面中。
          如果掃描器長時間未就緒或畫面持續黑色，請**打開瀏覽器開發者工具 (F12)，並檢查 iframe (AR畫面) 的 Console** 是否有錯誤訊息，特別是關於 `targets.mind` 檔案載入或 MindAR 初始化的錯誤 (例如 `RangeError`)。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative aspect-[3/4] w-full max-w-md mx-auto bg-muted rounded-md overflow-hidden border border-border">
          {isMindARLoading && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-4 text-center z-10">
                <ScanLine className="h-12 w-12 text-primary animate-pulse mb-2" />
                <p className="text-primary font-semibold">正在啟動 AR 掃描器...</p>
                <p className="text-xs text-muted-foreground mt-1">請稍候，MindAR 正在載入。如果長時間無反應或畫面持續黑色，**請務必檢查瀏覽器開發者工具中 iframe 的「主控台」(Console)**，尤其是確認 `targets.mind` 檔案是否正確載入且格式無誤（注意是否有 `RangeError`），以及 `public/mindar/index.html` 是否有 JavaScript 錯誤。</p>
             </div>
          )}
          <iframe
            src="/mindar/index.html"
            title="MindAR Scanner"
            className={`w-full h-full ${isMindARLoading ? 'opacity-50' : 'opacity-100 transition-opacity duration-500'}`}
            allow="camera; microphone"
            style={{ border: 'none' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onLoad={() => {
                console.log("ARScannerPlaceholder: MindAR iframe 'onLoad' event fired. 等待 'mindarReady' 訊息...");
            }}
            onError={(e) => {
                console.error("ARScannerPlaceholder: Iframe loading error:", e);
                if (mindARReadyTimerRef.current) clearTimeout(mindARReadyTimerRef.current);
                if (isMindARLoading) setIsMindARLoading(false);
                setScanMessage("載入 AR 掃描器 iframe 時發生錯誤。請檢查路徑是否正確 (public/mindar/index.html) 以及檔案內容。同時檢查主控台是否有 CSP 或其他錯誤。");
                setScanStatus("error");
                 toast({
                    variant: 'destructive',
                    title: 'Iframe 載入錯誤',
                    description: '無法載入 AR 掃描器。請檢查路徑、檔案內容以及瀏覽器 Console。',
                });
            }}
          />
        </div>

        {scanMessage && (
          <Alert
            variant={scanStatus === "error" ? "destructive" : scanStatus === "success" ? "default" : "default"}
            className="mt-4 whitespace-pre-line" // Ensure multi-line messages display correctly
          >
            {scanStatus === "success" && <CheckCircle className="h-4 w-4" />}
            {scanStatus === "error" && <AlertTriangle className="h-4 w-4" />}
            {scanStatus === "info" && <ScanLine className="h-4 w-4" />}
            <AlertTitle>{scanStatus === "success" ? "掃描成功" : scanStatus === "error" ? "掃描問題" : "掃描狀態"}</AlertTitle>
            <AlertDescription>{scanMessage}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
