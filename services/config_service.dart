import 'package:supabase_flutter/supabase_flutter.dart';

class ConfigService {
  /// Récupère le device actif défini dans la table app_config
  static Future<String?> fetchActiveDeviceId() async {
    final sb = Supabase.instance.client;

    final row = await sb
        .from('app_config')
        .select('value')
        .eq('key', 'active_device')
        .maybeSingle();

    if (row == null) return null;

    final value = row['value'] as Map<String, dynamic>;
    return value['device_id'] as String?;
  }
}
