import { useMemo } from "react"
import { CopyIcon, CheckIcon } from "@radix-ui/react-icons"
import { BrainCircuit, CircleUserRound } from "lucide-react"

import { cn } from "@/lib/utils"
import { useClipboard } from "@/components/ui/hooks"
import { Badge } from "@/components/ui"
import { Markdown } from "@/components/ui/markdown"

import { BadgeData, ChatHandler, Message, MessageAnnotationType } from "./types"
import { ChatMessageProvider } from "./ChatMessageProvider"
import { useChatUI } from "./useChatUI"
import { useChatMessage } from "./useChatMessage"

interface ChatMessageProps {
	message: Message
	isLast: boolean
	isHeaderVisible: boolean
	isLoading?: boolean
	append?: ChatHandler["append"]
}

export function ChatMessage({ message, isLast, isHeaderVisible, isLoading, append }: ChatMessageProps) {
	const badges = useMemo(
		() =>
			message.annotations
				?.filter(({ type }) => type === MessageAnnotationType.BADGE)
				.map(({ data }) => data as BadgeData),
		[message.annotations],
	)

	return (
		<ChatMessageProvider value={{ message, isLast }}>
			<div
				className={cn("relative group flex flex-col text-secondary-foreground", {
					"bg-vscode-input-background/50": message.role === "user",
				})}>
				{isHeaderVisible && <ChatMessageHeader badges={badges} />}
				<ChatMessageContent isHeaderVisible={isHeaderVisible} />
				<ChatMessageActions />
			</div>
		</ChatMessageProvider>
	)
}

interface ChatMessageHeaderProps {
	badges?: BadgeData[]
}

function ChatMessageHeader({ badges }: ChatMessageHeaderProps) {
	return (
		<div className="flex flex-row items-center justify-between border-t border-accent px-3 pt-3 pb-1">
			<ChatMessageAvatar />
			{badges?.map(({ label, variant = "outline" }) => (
				<Badge variant={variant} key={label}>
					{label}
				</Badge>
			))}
		</div>
	)
}

const icons: Record<string, React.ReactNode> = {
	user: <CircleUserRound className="h-4 w-4" />,
	assistant: <BrainCircuit className="h-4 w-4" />,
}

function ChatMessageAvatar() {
	const { assistantName } = useChatUI()
	const { message } = useChatMessage()

	return icons[message.role] ? (
		<div className="flex flex-row items-center gap-1">
			<div className="opacity-25 select-none">{icons[message.role]}</div>
			<div className="text-muted">{message.role === "user" ? "You" : assistantName}</div>
		</div>
	) : null
}

interface ChatMessageContentProps {
	isHeaderVisible: boolean
}

function ChatMessageContent({ isHeaderVisible }: ChatMessageContentProps) {
	const { message } = useChatMessage()
	let browserResult: { screenshot?: string; currentUrl?: string; logs?: string } | null = null

	// Attempt to parse content as JSON and check for screenshot
	if (typeof message.content === "string" && message.content.trim().startsWith("{")) {
		try {
			const parsed = JSON.parse(message.content)
			if (parsed && typeof parsed === "object" && parsed.screenshot) {
				console.log("[ChatMessageContent] Successfully parsed browser result with screenshot.") // Log success
				browserResult = parsed
			} else {
				console.log("[ChatMessageContent] Parsed JSON but no screenshot property found:", parsed) // Log missing property
				browserResult = null
			}
		} catch (e) {
			console.error(
				"[ChatMessageContent] Failed to parse message content as JSON:",
				e,
				"Content:",
				message.content,
			) // Log parsing error
			// Not valid JSON or doesn't have screenshot, treat as normal markdown
			browserResult = null
		}
	}

	return (
		<div className={cn("flex flex-col gap-4 flex-1 min-w-0 px-4 pb-6", { "pt-4": isHeaderVisible })}>
			{browserResult ? (
				<div className="flex flex-col gap-2">
					<img
						src={browserResult.screenshot}
						alt="Browser Screenshot"
						className="max-w-full h-auto border border-vscode-input-border rounded"
					/>
					{browserResult.currentUrl && (
						<p className="text-xs text-muted-foreground">
							Current URL:{" "}
							<a
								href={browserResult.currentUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="underline">
								{browserResult.currentUrl}
							</a>
						</p>
					)}
					{/* Optionally display logs if needed */}
					{/* {browserResult.logs && <pre className="text-xs bg-muted p-2 rounded">{browserResult.logs}</pre>} */}
				</div>
			) : (
				<Markdown content={message.content} />
			)}
		</div>
	)
}

function ChatMessageActions() {
	const { message } = useChatMessage()
	const { isCopied, copy } = useClipboard()

	return (
		<div
			className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-25 cursor-pointer"
			onClick={() => copy(message.content)}>
			{isCopied ? <CheckIcon /> : <CopyIcon />}
		</div>
	)
}
