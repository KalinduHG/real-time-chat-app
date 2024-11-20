using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public class ChatHub : Hub

{
    private readonly ChatMessageService _chatMessageService;

    public ChatHub(ChatMessageService chatMessageService)
    {
        _chatMessageService = chatMessageService;
    }

    // Thread-safe dictionary to store mapping
    private static readonly ConcurrentDictionary<int, (string Username, string ConnectionId)> UserConnections = new ConcurrentDictionary<int, (string, string)>();
    private static readonly ConcurrentDictionary<string, string> ActiveChatSessions = new ConcurrentDictionary<string, string>();

    public override async Task OnConnectedAsync()
    {
        var username = Context.User?.Identity?.Name;
        var userId = GetUserIdFromContext();

        if (!string.IsNullOrEmpty(username) && userId > 0)
        {
            UserConnections[userId] = (username, Context.ConnectionId);

            await UpdateOnlineUsers();
        }
        await base.OnConnectedAsync();
    }

    private int GetUserIdFromContext()
    {
        var userIdClaim = Context.User?.Claims.FirstOrDefault(c =>
        c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

        return int.TryParse(userIdClaim, out var userId) ? userId : 0;
    }

    public override async Task OnDisconnectedAsync(Exception exception)
    {
        var userId = GetUserIdFromContext();

        if (userId > 0 && UserConnections.TryRemove(userId, out var userDetails))
        {
            await UpdateOnlineUsers();
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendChatRequest(int receiverId)
    {
        var senderId = GetUserIdFromContext();

        if (senderId <= 0)
        {
            await Clients.Caller.SendAsync("ChatRequestFailed", "Invalid sender.");
            return;
        }

        if (ActiveChatSessions.TryGetValue(senderId.ToString(), out var existingChatPartnerId))
        {
            if (UserConnections.TryGetValue(int.Parse(existingChatPartnerId), out var existingChatPartnerDetails))
            {
                await Clients.Caller.SendAsync("ConfirmEndCurrentChat", existingChatPartnerDetails.Username, receiverId);
                return;
            }
        }

        if (UserConnections.TryGetValue(receiverId, out var receiverDetails))
        {
            await Clients.Client(receiverDetails.ConnectionId).SendAsync("ReceiveChatRequest", senderId);
            await Clients.Caller.SendAsync("ChatRequestResponse", "Chat request sent!");
        }
        else
        {
            await Clients.Caller.SendAsync("ChatRequestFailed", "The user is not available.");
        }
    }

    public async Task SendMessage(string message, int senderId, int receiverId)
    {
        if (UserConnections.TryGetValue(senderId, out var senderDetails) &&
            UserConnections.TryGetValue(receiverId, out var receiverDetails))
        {
            var chatMessage = new ChatMessage
            {
                SenderId = senderId,
                ReceiverId = receiverId,
                Message = message,
                SentAt = DateTime.UtcNow
            };
            await _chatMessageService.SaveMessageAsync(chatMessage);

            await Clients.Client(receiverDetails.ConnectionId).SendAsync("ReceiveMessage", senderDetails.Username, message, senderId);
            await Clients.Client(senderDetails.ConnectionId).SendAsync("ReceiveMessage", senderDetails.Username, message, senderId);

            var messages = await _chatMessageService.GetChatMessagesAsync(senderId, receiverId);
            await Clients.Caller.SendAsync("ChatHistoryLoaded", messages);
            await Clients.Client(receiverDetails.ConnectionId).SendAsync("ChatHistoryLoaded", messages);
        }
        else
        {
            await Clients.Caller.SendAsync("ChatRequestFailed", $"Either sender ({senderId}) or receiver ({receiverId}) is not connected.");
        }
    }

    private Task UpdateOnlineUsers()
    {
        var onlineUsers = UserConnections.Select(kvp => new
        {
            UserId = kvp.Key,
            Username = kvp.Value.Username
        }).ToList();
        return Clients.All.SendAsync("OnlineUsersUpdated", onlineUsers);
    }

    public async Task EndChatSession(int chatPartnerId)
    {
        var userId = GetUserIdFromContext();

        if (userId <= 0)
        {
            await Clients.Caller.SendAsync("ChatRequestFailed", "Invalid User");
            return;
        }

        if (ActiveChatSessions.TryGetValue(userId.ToString(), out var activeChatPartnerId) && activeChatPartnerId == chatPartnerId.ToString())
        {
            if (UserConnections.TryGetValue(userId, out var userDetails) &&
                 UserConnections.TryGetValue(chatPartnerId, out var partnerDetails))
            {
                await Clients.Client(partnerDetails.ConnectionId).SendAsync("ChatSessionEnded", userDetails.Username);
                await Clients.Client(Context.ConnectionId).SendAsync("ChatSessionEnded", partnerDetails.Username);
            }

            ActiveChatSessions.TryRemove(userId.ToString(), out _);
            ActiveChatSessions.TryRemove(chatPartnerId.ToString(), out _);


        }
        else
        {
            await Clients.Caller.SendAsync("ChatRequestFailed", "No active chat session.");
        }
    }

    public async Task RespondToChatRequest(int requesterId, bool isAccepted)
    {
        var receiverId = GetUserIdFromContext();

        if (receiverId <= 0)
        {
            await Clients.Caller.SendAsync("ChatRequestFailed", "Invalid User");
            return;
        }

        if (isAccepted)
        {
            if (ActiveChatSessions.TryGetValue(receiverId.ToString(), out var existingChatPartnerId))
            {
                if (UserConnections.TryGetValue(int.Parse(existingChatPartnerId), out var existingChatPartnerDetails))
                {
                    await Clients.Caller.SendAsync("ConfirmEndCurrentChat", existingChatPartnerDetails.Username, requesterId);
                    return;
                }
            }

            if (UserConnections.TryGetValue(requesterId, out var requesterDetails) && UserConnections.TryGetValue(receiverId, out var receiverDetails))
            {
                ActiveChatSessions[requesterId.ToString()] = receiverId.ToString();
                ActiveChatSessions[receiverId.ToString()] = requesterId.ToString();

                await Clients.Client(requesterDetails.ConnectionId).SendAsync("ChatSessionStarted", receiverId, receiverDetails.Username);
                await Clients.Client(Context.ConnectionId).SendAsync("ChatSessionStarted", requesterId, requesterDetails.Username);

            }
            else
            {
                await Clients.Caller.SendAsync("ChatRequestFailed", "Requester not found");
            }
        }
        else
        {
            if (UserConnections.TryGetValue(requesterId, out var requesterDetails))
            {
                await Clients.Client(requesterDetails.ConnectionId).SendAsync("ChatRequestDeclined", receiverId);
            }
            else
            {
                await Clients.Caller.SendAsync("ChatRequestFailed", "Requester not found");
            }
        }
    }

    public async Task EndCurrentChatAndStartNew(int newRequesterId)
    {
        var receiverId = GetUserIdFromContext();

        if (ActiveChatSessions.TryGetValue(receiverId.ToString(), out var existingChatPartnerId))
        {
            ActiveChatSessions.TryRemove(receiverId.ToString(), out _);
            ActiveChatSessions.TryRemove(existingChatPartnerId, out _);

            if (UserConnections.TryGetValue(int.Parse(existingChatPartnerId), out var existingChatPartnerDetails) &&
                 UserConnections.TryGetValue(receiverId, out var receiverDetails))
            {
                await Clients.Client(existingChatPartnerDetails.ConnectionId)
                   .SendAsync("ChatSessionEnded", receiverDetails.Username); // Send receiver's username to the partner
                await Clients.Client(Context.ConnectionId)
                    .SendAsync("ChatSessionEnded", existingChatPartnerDetails.Username); // Send partner's username to the receiver
            }
        }

        await RespondToChatRequest(newRequesterId, true);
    }

    public async Task FetchChatHistory(int partnerId)
    {
        var userId = GetUserIdFromContext();

        if (userId <= 0)
        {
            await Clients.Caller.SendAsync("ChatRequestFailed", "Invalid user ID");
            return;
        }

        var messages = await _chatMessageService.GetChatMessagesAsync(userId, partnerId);

        await Clients.Caller.SendAsync("ChatHistoryLoaded", messages);
    }

}
