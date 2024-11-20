using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Caching.Memory;
using System;
using System.Data;

public class ChatMessageService
{
    private readonly string _connectionString;
    private readonly IMemoryCache _cache;

    public ChatMessageService(string connectionString, IMemoryCache cache)
    {
        _connectionString = connectionString;
        _cache = cache;
    }

    public async Task SaveMessageAsync(ChatMessage message)
    {
        try
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                await connection.OpenAsync();

                using (var command = new SqlCommand("sp_SaveChatMessage", connection))
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.Parameters.Add(new SqlParameter("@SenderId", SqlDbType.Int) { Value = message.SenderId });
                    command.Parameters.Add(new SqlParameter("@ReceiverId", SqlDbType.Int) { Value = message.ReceiverId });
                    command.Parameters.Add(new SqlParameter("@Message", SqlDbType.NVarChar) { Value = message.Message });
                    command.Parameters.Add(new SqlParameter("@SentAt", SqlDbType.DateTime) { Value = message.SentAt });

                    await command.ExecuteNonQueryAsync();
                }
            }
            string cacheKey = GetCacheKey(message.SenderId, message.ReceiverId);
            _cache.Remove(cacheKey);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error saving message: {ex.Message}");
            throw;
        }
    }

    public async Task<List<ChatMessage>> GetChatMessagesAsync(int senderId, int receiverId)
    {
        string cacheKey = GetCacheKey(senderId, receiverId);

        if (_cache.TryGetValue(cacheKey, out List<ChatMessage> cachedMessages))
        {
            return cachedMessages;
        }

        var messages = new List<ChatMessage>();
        try
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                using (var command = new SqlCommand("sp_GetChatMessages", connection))
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.Parameters.AddWithValue("@SenderId", senderId);
                    command.Parameters.AddWithValue("@ReceiverId", receiverId);

                    connection.Open();
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            messages.Add(new ChatMessage
                            {
                                Id = Convert.ToInt32(reader["Id"]),
                                SenderId = Convert.ToInt32(reader["SenderId"]),
                                ReceiverId = Convert.ToInt32(reader["ReceiverId"]),
                                Message = reader["Message"].ToString(),
                                SentAt = Convert.ToDateTime(reader["Timestamp"])
                            });
                        }
                    }
                }
            }
            _cache.Set(cacheKey, messages, TimeSpan.FromMinutes(5));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error get message: {ex.Message}");
            throw;
        }
        return messages;
    }

    private string GetCacheKey(int senderId, int receiverId) =>
        $"ChatMessages_{Math.Min(senderId, receiverId)}_{Math.Max(senderId, receiverId)}";

}
